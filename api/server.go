package main

import (
	"compress/gzip"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
)

// Server exposes the read-only REST API the frontend polls.
type Server struct {
	store       *Store
	nodes       *NodeRegistry
	observers   *ObserverRegistry
	links       *LinkRegistry
	imported    *ImportRegistry
	metrics     *Metrics
	hub         *Hub
	allowOrigin string
}

func NewServer(store *Store, nodes *NodeRegistry, observers *ObserverRegistry, links *LinkRegistry, imported *ImportRegistry, metrics *Metrics, hub *Hub, allowOrigin string) *Server {
	return &Server{store: store, nodes: nodes, observers: observers, links: links, imported: imported, metrics: metrics, hub: hub, allowOrigin: allowOrigin}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	// Each route is instrumented under a fixed, normalized label so path
	// variables (network id, pubkey) never inflate metric cardinality.
	mux.HandleFunc("/api/health", s.instrument("/api/health", s.handleHealth))
	mux.HandleFunc("/api/networks", s.instrument("/api/networks", s.handleNetworks))
	mux.HandleFunc("/api/networks/", s.instrument("/api/networks/:id", s.handleNetworkDetail))
	mux.HandleFunc("/api/nodes", s.instrument("/api/nodes", s.handleNodes))
	mux.HandleFunc("/api/nodes/", s.instrument("/api/nodes/:pubkey", s.handleNodeSub))
	mux.HandleFunc("/api/map", s.instrument("/api/map", s.handleMap))
	mux.HandleFunc("/api/route", s.instrument("/api/route", s.handleRoute))
	mux.HandleFunc("/api/observers", s.instrument("/api/observers", s.handleObservers))
	// Prometheus/VictoriaMetrics scrape endpoint. Left un-instrumented to avoid
	// the scraper polluting the API latency histograms.
	if s.metrics != nil {
		mux.Handle("/metrics", s.metrics.handler())
	}
	wrapped := s.withCORS(gzipMiddleware(mux))
	if s.hub == nil {
		return wrapped
	}
	// The live advert feed upgrades to a WebSocket, which hijacks the underlying
	// connection — so it must bypass the gzip middleware. A dedicated outer mux
	// routes the upgrade directly to the hub; everything else falls through to the
	// gzipped+CORS REST handler. (The more specific "/api/live" pattern wins over
	// "/" in Go's ServeMux.)
	root := http.NewServeMux()
	root.Handle("/", wrapped)
	root.HandleFunc("/api/live", s.hub.ServeWS)
	return root
}

// gzipMiddleware compresses responses for clients that accept gzip. The map
// "all nodes" payload is a few MB of JSON, so this is a meaningful win; small
// responses compress harmlessly.
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		next.ServeHTTP(&gzipResponseWriter{ResponseWriter: w, gz: gz}, r)
	})
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gz *gzip.Writer
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	// Content-Length would describe the uncompressed size; drop it.
	g.Header().Del("Content-Length")
	return g.gz.Write(b)
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.allowOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// --- response shapes ---

type networkSummary struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	PktPerMin          float64 `json:"pktPerMin"`
	UniquePackets      uint64  `json:"uniquePackets"`
	Observations       uint64  `json:"observations"`
	Observers          int     `json:"observers"`
	Nodes              int     `json:"nodes"`
	AnalyzersTotal     int     `json:"analyzersTotal"`
	AnalyzersConnected int     `json:"analyzersConnected"`
	LastPacketAt       int64   `json:"lastPacketAt"`
}

type analyzerDetail struct {
	Name           string            `json:"name"`
	URL            string            `json:"url"`
	Connected      bool              `json:"connected"`
	ConnectedSince int64             `json:"connectedSince"`
	LastError      string            `json:"lastError,omitempty"`
	PktPerMin      float64           `json:"pktPerMin"`
	UniquePackets  uint64            `json:"uniquePackets"`
	Observations   uint64            `json:"observations"`
	Observers      int               `json:"observers"`
	Nodes          int               `json:"nodes"`
	PayloadTypes   map[string]uint64 `json:"payloadTypes"`
	LastPacketAt   int64             `json:"lastPacketAt"`
}

type networkDetail struct {
	networkSummary
	PayloadTypes map[string]uint64 `json:"payloadTypes"`
	Analyzers    []analyzerDetail  `json:"analyzers"`
}

func (s *Server) summaryFor(ns *NetworkState, now int64) networkSummary {
	snap := ns.Counter.Snapshot(now)
	connected := 0
	for _, a := range ns.Analyzers {
		if ok, _, _ := a.status(); ok {
			connected++
		}
	}
	return networkSummary{
		ID:                 ns.ID,
		Name:               ns.Name,
		PktPerMin:          snap.PktPerMin,
		UniquePackets:      snap.UniquePackets,
		Observations:       snap.Observations,
		Observers:          snap.Observers,
		Nodes:              snap.Nodes,
		AnalyzersTotal:     len(ns.Analyzers),
		AnalyzersConnected: connected,
		LastPacketAt:       snap.LastPacketAt,
	}
}

func (s *Server) handleNetworks(w http.ResponseWriter, r *http.Request) {
	now := nowUnix()
	out := make([]networkSummary, 0, len(s.store.Networks))
	for _, ns := range s.store.Networks {
		out = append(out, s.summaryFor(ns, now))
	}
	writeJSON(w, http.StatusOK, map[string]any{"networks": out})
}

func (s *Server) handleNetworkDetail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/networks/")
	id = strings.Trim(id, "/")
	ns := s.store.Network(id)
	if ns == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown network"})
		return
	}
	now := nowUnix()
	netSnap := ns.Counter.Snapshot(now)

	analyzers := make([]analyzerDetail, 0, len(ns.Analyzers))
	for _, a := range ns.Analyzers {
		snap := a.Counter.Snapshot(now)
		connected, since, lastErr := a.status()
		analyzers = append(analyzers, analyzerDetail{
			Name:           a.Name,
			URL:            a.URL,
			Connected:      connected,
			ConnectedSince: since,
			LastError:      lastErr,
			PktPerMin:      snap.PktPerMin,
			UniquePackets:  snap.UniquePackets,
			Observations:   snap.Observations,
			Observers:      snap.Observers,
			Nodes:          snap.Nodes,
			PayloadTypes:   snap.PayloadTypes,
			LastPacketAt:   snap.LastPacketAt,
		})
	}

	writeJSON(w, http.StatusOK, networkDetail{
		networkSummary: s.summaryFor(ns, now),
		PayloadTypes:   netSnap.PayloadTypes,
		Analyzers:      analyzers,
	})
}

// handleNodes serves the global node registry overview. Each node carries the
// set of networks it has been heard on and its own rolling list of recent adverts.
func (s *Server) handleNodes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"nodes": s.nodes.Snapshot(),
	})
}

// link endpoint defaults: 50 links returned by default, hard-capped at 200,
// sorted by recent activity descending.
const (
	defaultLinksLimit = 50
	maxLinksLimit     = 200
)

// linkNeighborView is the neighbor metadata embedded in a link, resolved through
// the global node registry (with an imported-directory fallback) so the frontend
// can render the link without a second request. Coordinates are omitted when the
// neighbor has no known GPS — such links list but cannot be drawn.
type linkNeighborView struct {
	PubKey   string  `json:"pubkey"`
	Name     string  `json:"name"`
	Type     byte    `json:"type"`
	TypeName string  `json:"typeName"`
	HasGPS   bool    `json:"hasGps"`
	Lat      float64 `json:"lat,omitempty"`
	Lon      float64 `json:"lon,omitempty"`
}

type linkView struct {
	Neighbor       linkNeighborView `json:"neighbor"`
	PacketCount    uint64           `json:"packetCount"`
	RecentActivity float64          `json:"recentActivity"`
	FirstSeen      int64            `json:"firstSeen"`
	LastSeen       int64            `json:"lastSeen"`
	Networks       []string         `json:"networks"`
}

// handleNodeSub routes /api/nodes/{pubkey}/links (the only sub-resource today).
func (s *Server) handleNodeSub(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/nodes/")
	pubkey, sub, _ := strings.Cut(rest, "/")
	sub = strings.Trim(sub, "/")
	if sub == "links" {
		s.handleNodeLinks(w, r, pubkey)
		return
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

// handleNodeLinks serves the observed links for one node:
//
//	GET /api/nodes/{pubkey}/links?limit=&active=&networks=
//
// Only links with the selected node as an endpoint are returned (never the global
// topology). The network filter narrows which links are included but never changes
// the globally-deduplicated packet count. Neighbor metadata is resolved here so
// the frontend needs no follow-up request.
func (s *Server) handleNodeLinks(w http.ResponseWriter, r *http.Request, rawPub string) {
	node, ok := normalizePub(rawPub)
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid pubkey"})
		return
	}
	pubHex := hex.EncodeToString(node[:])

	qv := r.URL.Query()
	limit := atoiDefault(qv.Get("limit"), defaultLinksLimit)
	if limit <= 0 {
		limit = defaultLinksLimit
	}
	if limit > maxLinksLimit {
		limit = maxLinksLimit
	}
	netFilter := parseStringSet(qv.Get("networks"))
	var since int64
	if d, ok := parseActive(qv.Get("active")); ok {
		since = nowUnix() - int64(d.Seconds())
	}

	now := nowUnix()
	all := s.links.LinksForNode(node, now)

	// Apply the network and activity filters. The network filter only includes or
	// excludes whole links; it does not touch packetCount.
	filtered := all[:0:0]
	for _, l := range all {
		if since > 0 && l.LastSeen < since {
			continue
		}
		if len(netFilter) > 0 && !anyInSet(l.Networks, netFilter) {
			continue
		}
		filtered = append(filtered, l)
	}

	sortNeighborsByActivity(filtered)
	total := len(filtered)
	capped := false
	if len(filtered) > limit {
		filtered = filtered[:limit]
		capped = true
	}

	var imported []*ImportedNode
	if s.imported != nil {
		imported = s.imported.Records()
	}

	views := make([]linkView, 0, len(filtered))
	for _, l := range filtered {
		views = append(views, linkView{
			Neighbor:       s.neighborView(l.Neighbor, imported),
			PacketCount:    l.PacketCount,
			RecentActivity: round2(l.RecentActivity),
			FirstSeen:      l.FirstSeen,
			LastSeen:       l.LastSeen,
			Networks:       l.Networks,
		})
	}

	w.Header().Set("Cache-Control", "public, max-age=15")
	writeJSON(w, http.StatusOK, map[string]any{
		"node":     pubHex,
		"links":    views,
		"returned": len(views),
		"total":    total,
		"capped":   capped,
	})
}

// neighborView resolves a neighbor's display metadata: live node registry first,
// then the imported directory (which may enrich identity but never creates links).
// A neighbor with no known data still returns, flagged non-drawable (HasGPS false).
func (s *Server) neighborView(pubkey string, imported []*ImportedNode) linkNeighborView {
	if n, ok := s.nodes.Lookup(pubkey); ok {
		return linkNeighborView{
			PubKey:   n.PubKey,
			Name:     n.Name,
			Type:     n.NodeType,
			TypeName: nodeTypeName(n.NodeType),
			HasGPS:   n.HasGPS,
			Lat:      n.Lat,
			Lon:      n.Lon,
		}
	}
	for _, in := range imported {
		if in.PublicKey == pubkey {
			t := byte(in.Type)
			v := linkNeighborView{
				PubKey:   pubkey,
				Name:     in.AdvName,
				Type:     t,
				TypeName: nodeTypeName(t),
			}
			if in.hasCoords() {
				v.HasGPS = true
				v.Lat = in.AdvLat
				v.Lon = in.AdvLon
			}
			return v
		}
	}
	return linkNeighborView{PubKey: pubkey, TypeName: nodeTypeName(0)}
}

// anyInSet reports whether any value is present in the set.
func anyInSet(values []string, set map[string]bool) bool {
	for _, v := range values {
		if set[v] {
			return true
		}
	}
	return false
}

// routeHopView is one leg of a computed route, ready for JSON. The endpoint
// pubkeys are implied by the surrounding nodes list (hop i joins nodes[i] and
// nodes[i+1]), so only the link's own stats live here.
type routeHopView struct {
	PacketCount    uint64   `json:"packetCount"`
	RecentActivity float64  `json:"recentActivity"`
	FirstSeen      int64    `json:"firstSeen"`
	LastSeen       int64    `json:"lastSeen"`
	Networks       []string `json:"networks"`
}

// handleRoute serves a best-effort path between two nodes over the observed-link
// graph:
//
//	GET /api/route?from={pubkey}&to={pubkey}&active=&networks=
//
// The path is the lowest-cost route where each hop is weighted by how recent and
// busy that link is (see route.go). active/networks narrow the graph exactly like
// the links endpoint. When the two nodes are not connected through the filtered
// graph, found is false and nodes/hops are empty. Each node carries the same
// metadata shape as a link neighbor, so the frontend can draw the polyline and
// label each hop without follow-up requests.
func (s *Server) handleRoute(w http.ResponseWriter, r *http.Request) {
	qv := r.URL.Query()
	from, okFrom := normalizePub(qv.Get("from"))
	to, okTo := normalizePub(qv.Get("to"))
	if !okFrom || !okTo {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid from/to pubkey"})
		return
	}

	netFilter := parseStringSet(qv.Get("networks"))
	var since int64
	if d, ok := parseActive(qv.Get("active")); ok {
		since = nowUnix() - int64(d.Seconds())
	}

	now := nowUnix()
	res := s.links.RouteBetween(from, to, now, since, netFilter)

	var imported []*ImportedNode
	if s.imported != nil {
		imported = s.imported.Records()
	}

	nodes := make([]linkNeighborView, 0, len(res.Nodes))
	for _, pk := range res.Nodes {
		nodes = append(nodes, s.neighborView(pk, imported))
	}
	hops := make([]routeHopView, 0, len(res.Hops))
	for _, h := range res.Hops {
		hops = append(hops, routeHopView{
			PacketCount:    h.PacketCount,
			RecentActivity: round2(h.RecentActivity),
			FirstSeen:      h.FirstSeen,
			LastSeen:       h.LastSeen,
			Networks:       h.Networks,
		})
	}

	w.Header().Set("Cache-Control", "public, max-age=15")
	writeJSON(w, http.StatusOK, map[string]any{
		"from":  hex.EncodeToString(from[:]),
		"to":    hex.EncodeToString(to[:]),
		"found": res.Found,
		"nodes": nodes,
		"hops":  hops,
	})
}

// handleMap serves a viewport query against the node registry as a GeoJSON
// FeatureCollection: aggregated clusters at low zoom, individual nodes when
// searching or zoomed in. Responses are cheap and change slowly, so they carry a
// short shared cache lifetime.
//
// Query params:
//   - bbox=west,south,east,north  viewport in degrees (ignored when q is set)
//   - zoom=<int>                  map zoom level (controls cluster granularity)
//   - types=1,2,3,4               node types to include (chat/repeater/room/sensor)
//   - networks=id,id              network IDs to include
//   - since=<unix> | active=24h|7d|30d   keep nodes seen within the window
//   - q=<text>                    name substring or pubkey hex prefix (global)
//   - limit=<int>                 cap on individual node features
func (s *Server) handleMap(w http.ResponseWriter, r *http.Request) {
	qv := r.URL.Query()
	p := MapParams{
		Zoom:     atoiDefault(qv.Get("zoom"), 0),
		Types:    parseByteSet(qv.Get("types")),
		Networks: parseStringSet(qv.Get("networks")),
		Q:        strings.TrimSpace(qv.Get("q")),
		Limit:    atoiDefault(qv.Get("limit"), 0),
		All:      qv.Get("all") == "1" || qv.Get("all") == "true",
	}
	if bbox, ok := parseBBox(qv.Get("bbox")); ok {
		p.BBox, p.HasBBox = bbox, true
	}
	if since := qv.Get("since"); since != "" {
		p.Since = int64(atoiDefault(since, 0))
	} else if d, ok := parseActive(qv.Get("active")); ok {
		p.Since = nowUnix() - int64(d.Seconds())
	}

	var imported []*ImportedNode
	if s.imported != nil {
		imported = s.imported.Records()
	}

	w.Header().Set("Cache-Control", "public, max-age=30")
	writeJSON(w, http.StatusOK, s.nodes.MapQuery(p, imported))
}

// handleObservers serves the global observer activity table, most recently
// active first.
func (s *Server) handleObservers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"observers": s.observers.Snapshot(),
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	now := nowUnix()
	analyzers, connected := 0, 0
	for _, ns := range s.store.Networks {
		for _, a := range ns.Analyzers {
			analyzers++
			if ok, _, _ := a.status(); ok {
				connected++
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                 true,
		"networks":           len(s.store.Networks),
		"analyzers":          analyzers,
		"analyzersConnected": connected,
		"time":               now,
	})
}
