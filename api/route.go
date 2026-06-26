package main

import (
	"container/heap"
	"encoding/hex"
	"math"
)

// Best-effort routing over the observed-link graph. A "route" is a shortest path
// between two nodes through links we have actually seen carry traffic, where each
// hop is weighted by how reliable that link looks right now — recent, busy links
// are cheap; stale or rarely-seen ones are expensive. This is *not* a prediction
// of what the mesh firmware would do, only a most-plausible path through the
// links in our database.

// routeHopBase is the fixed per-hop cost. It biases the search toward fewer hops
// so the reliability penalty only tips the balance between paths of similar
// length, rather than chaining many "perfect" links into an absurdly long route.
const routeHopBase = 1.0

// edgeCost scores one link for routing: lower is better. A link seen seconds ago
// with heavy traffic approaches routeHopBase; an old, barely-seen link costs much
// more. recency decays with the same ~1-week falloff the map uses for link
// opacity, and strength rewards sustained activity (log so a 10× busier link is
// not 10× preferred).
func edgeCost(recentActivity float64, lastSeen, now int64) float64 {
	ageDays := math.Max(0, float64(now-lastSeen)/86400)
	recency := math.Exp(-ageDays / 7) // 0..1, ~1-week half-ish falloff
	strength := 1 + math.Log1p(math.Max(0, recentActivity))
	quality := recency * strength
	if quality < 1e-6 {
		quality = 1e-6
	}
	return routeHopBase + 1/quality
}

// routeEdge is one adjacency entry: the neighbor plus the link's stats, copied
// out of the registry so the Dijkstra search runs without holding shard locks.
type routeEdge struct {
	to             pubKey
	packetCount    uint64
	recentActivity float64
	firstSeen      int64
	lastSeen       int64
	networks       []string
	cost           float64
}

// RouteHop is one leg of a computed route, described independently of direction
// (From → To follow the path order). The neighbor metadata is resolved by the
// HTTP handler, like the links endpoint.
type RouteHop struct {
	From           string
	To             string
	PacketCount    uint64
	RecentActivity float64
	FirstSeen      int64
	LastSeen       int64
	Networks       []string
}

// RouteResult is an ordered path from source to destination. Nodes has one more
// entry than Hops: Nodes[i] and Nodes[i+1] are the endpoints of Hops[i]. Found is
// false when no path exists through the (filtered) link graph.
type RouteResult struct {
	Found bool
	Nodes []string // ordered pubkeys, source first
	Hops  []RouteHop
}

// buildAdjacency materializes the link graph once, applying the same recency and
// network filters as the links endpoint. Only edges that pass the filters are
// kept, so the search never traverses a link the caller asked to exclude. Each
// edge is stored on both endpoints (the graph is undirected).
func (r *LinkRegistry) buildAdjacency(now, since int64, netFilter map[string]bool) map[pubKey][]routeEdge {
	adj := make(map[pubKey][]routeEdge)
	add := func(from, to pubKey, rec *LinkRecord, nets []string) {
		adj[from] = append(adj[from], routeEdge{
			to:             to,
			packetCount:    rec.PacketCount,
			recentActivity: decayedScore(rec.Score, rec.ScoreUpdatedAt, now, r.halfLife),
			firstSeen:      rec.FirstSeen,
			lastSeen:       rec.LastSeen,
			networks:       nets,
			cost:           edgeCost(decayedScore(rec.Score, rec.ScoreUpdatedAt, now, r.halfLife), rec.LastSeen, now),
		})
	}
	for i := range r.shards {
		sh := &r.shards[i]
		sh.mu.Lock()
		for key, rec := range sh.links {
			if since > 0 && rec.LastSeen < since {
				continue
			}
			nets := make([]string, len(rec.Networks))
			for j, n := range rec.Networks {
				nets[j] = n.NetworkID
			}
			if len(netFilter) > 0 && !anyInSet(nets, netFilter) {
				continue
			}
			var a, b pubKey
			copy(a[:], key[:32])
			copy(b[:], key[32:])
			add(a, b, rec, nets)
			add(b, a, rec, nets)
		}
		sh.mu.Unlock()
	}
	return adj
}

// pqItem / priorityQueue back the Dijkstra frontier (min-heap on tentative cost).
type pqItem struct {
	node pubKey
	cost float64
}

type priorityQueue []pqItem

func (pq priorityQueue) Len() int           { return len(pq) }
func (pq priorityQueue) Less(i, j int) bool { return pq[i].cost < pq[j].cost }
func (pq priorityQueue) Swap(i, j int)      { pq[i], pq[j] = pq[j], pq[i] }
func (pq *priorityQueue) Push(x any)        { *pq = append(*pq, x.(pqItem)) }
func (pq *priorityQueue) Pop() any {
	old := *pq
	n := len(old)
	it := old[n-1]
	*pq = old[:n-1]
	return it
}

// RouteBetween finds the lowest-cost path from `from` to `to` over the observed
// links, with each hop weighted by {@link edgeCost}. since/netFilter narrow the
// graph exactly like the links endpoint. The result path is reconstructed in
// source→destination order. Found is false when the two nodes are not connected
// through the filtered graph (including when either has no links at all).
func (r *LinkRegistry) RouteBetween(from, to pubKey, now, since int64, netFilter map[string]bool) RouteResult {
	if from == to {
		return RouteResult{Found: true, Nodes: []string{hex.EncodeToString(from[:])}}
	}
	adj := r.buildAdjacency(now, since, netFilter)
	if len(adj[from]) == 0 || len(adj[to]) == 0 {
		return RouteResult{Found: false}
	}

	dist := map[pubKey]float64{from: 0}
	prev := map[pubKey]pubKey{}
	prevEdge := map[pubKey]routeEdge{}
	done := map[pubKey]bool{}

	pq := &priorityQueue{{node: from, cost: 0}}
	heap.Init(pq)

	for pq.Len() > 0 {
		cur := heap.Pop(pq).(pqItem)
		if done[cur.node] {
			continue
		}
		done[cur.node] = true
		if cur.node == to {
			break
		}
		for _, e := range adj[cur.node] {
			if done[e.to] {
				continue
			}
			nd := cur.cost + e.cost
			if best, ok := dist[e.to]; !ok || nd < best {
				dist[e.to] = nd
				prev[e.to] = cur.node
				prevEdge[e.to] = e
				heap.Push(pq, pqItem{node: e.to, cost: nd})
			}
		}
	}

	if !done[to] {
		return RouteResult{Found: false}
	}

	// Walk predecessors back to the source, then reverse into path order.
	var revNodes []pubKey
	var revHops []RouteHop
	for n := to; ; {
		revNodes = append(revNodes, n)
		if n == from {
			break
		}
		e := prevEdge[n]
		p := prev[n]
		revHops = append(revHops, RouteHop{
			From:           hex.EncodeToString(p[:]),
			To:             hex.EncodeToString(n[:]),
			PacketCount:    e.packetCount,
			RecentActivity: e.recentActivity,
			FirstSeen:      e.firstSeen,
			LastSeen:       e.lastSeen,
			Networks:       e.networks,
		})
		n = p
	}

	nodes := make([]string, len(revNodes))
	for i, n := range revNodes {
		nodes[len(revNodes)-1-i] = hex.EncodeToString(n[:])
	}
	hops := make([]RouteHop, len(revHops))
	for i := range revHops {
		hops[len(revHops)-1-i] = revHops[i]
	}
	return RouteResult{Found: true, Nodes: nodes, Hops: hops}
}
