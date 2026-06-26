package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// helper: pubKey from the hex identity used by pk().
func mustPub(t *testing.T, s string) pubKey {
	t.Helper()
	k, ok := normalizePub(s)
	if !ok {
		t.Fatalf("bad pubkey %q", s)
	}
	return k
}

// A straight chain A—B—C—D routes end to end in order.
func TestRouteChain(t *testing.T) {
	a, b, c, d := pk(1), pk(2), pk(3), pk(4)
	reg := noDecay()
	reg.ObservePath("h1", "net", []string{a, b, c, d}, 100)

	res := reg.RouteBetween(mustPub(t, a), mustPub(t, d), 200, 0, nil)
	if !res.Found {
		t.Fatalf("expected a route A→D")
	}
	want := []string{a, b, c, d}
	if len(res.Nodes) != len(want) {
		t.Fatalf("path = %v, want %v", res.Nodes, want)
	}
	for i := range want {
		if res.Nodes[i] != want[i] {
			t.Fatalf("path[%d] = %s, want %s", i, res.Nodes[i], want[i])
		}
	}
	if len(res.Hops) != 3 {
		t.Fatalf("hops = %d, want 3", len(res.Hops))
	}
}

// Reliability wins: A—C—B (two recent, busy hops) beats the direct A—B link that
// was seen once long ago, even though the direct link is one hop fewer.
func TestRoutePrefersReliablePath(t *testing.T) {
	a, b, c := pk(1), pk(2), pk(3)
	reg := newLinkRegistry(defaultLinkHalfLife)

	// Direct A—B: a single observation 30 days before "now".
	now := int64(30*86400 + 1000)
	old := int64(1000)
	reg.ObservePath("old", "net", []string{a, b}, old)

	// A—C and C—B: many recent observations near "now".
	for i := int64(0); i < 50; i++ {
		reg.ObservePath(hexHash(i, "ac"), "net", []string{a, c}, now-i)
		reg.ObservePath(hexHash(i, "cb"), "net", []string{c, b}, now-i)
	}

	res := reg.RouteBetween(mustPub(t, a), mustPub(t, b), now, 0, nil)
	if !res.Found {
		t.Fatal("expected a route")
	}
	if len(res.Nodes) != 3 || res.Nodes[1] != c {
		t.Fatalf("path = %v, want detour through C", res.Nodes)
	}
}

// Disconnected nodes report no route.
func TestRouteDisconnected(t *testing.T) {
	a, b, c, d := pk(1), pk(2), pk(3), pk(4)
	reg := noDecay()
	reg.ObservePath("h1", "net", []string{a, b}, 100)
	reg.ObservePath("h2", "net", []string{c, d}, 100)

	if res := reg.RouteBetween(mustPub(t, a), mustPub(t, d), 200, 0, nil); res.Found {
		t.Fatalf("expected no route, got %v", res.Nodes)
	}
}

// The active window can exclude an otherwise-usable link, breaking the path.
func TestRouteActiveFilter(t *testing.T) {
	a, b, c := pk(1), pk(2), pk(3)
	reg := noDecay()
	reg.ObservePath("h1", "net", []string{a, b}, 100)   // stale
	reg.ObservePath("h2", "net", []string{b, c}, 10000) // recent

	// since cutoff above the stale A—B link removes it, disconnecting A from C.
	if res := reg.RouteBetween(mustPub(t, a), mustPub(t, c), 10000, 5000, nil); res.Found {
		t.Fatalf("expected no route once stale link filtered, got %v", res.Nodes)
	}
	// Without the filter the route exists.
	if res := reg.RouteBetween(mustPub(t, a), mustPub(t, c), 10000, 0, nil); !res.Found {
		t.Fatal("expected a route without the active filter")
	}
}

// The HTTP endpoint resolves neighbor metadata, returns the ordered path, and
// rejects malformed pubkeys. Reuses the links-test seed (A linked to B/C/D/E).
func TestRouteEndpoint(t *testing.T) {
	srv, a, ids := seedLinkEnv(t)

	type routeResp struct {
		From  string `json:"from"`
		To    string `json:"to"`
		Found bool   `json:"found"`
		Nodes []struct {
			PubKey string `json:"pubkey"`
			Name   string `json:"name"`
			HasGPS bool   `json:"hasGps"`
		} `json:"nodes"`
		Hops []struct {
			PacketCount uint64 `json:"packetCount"`
		} `json:"hops"`
	}

	get := func(query string) (int, routeResp) {
		req := httptest.NewRequest(http.MethodGet, "/api/route?"+query, nil)
		rr := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rr, req)
		var resp routeResp
		if rr.Code == http.StatusOK {
			if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v (body %s)", err, rr.Body.String())
			}
		}
		return rr.Code, resp
	}

	// A → B is a direct one-hop route; the neighbor metadata is resolved (Bravo).
	code, resp := get("from=" + a + "&to=" + ids[0xb0])
	if code != http.StatusOK || !resp.Found {
		t.Fatalf("A→B: code=%d found=%v, want 200/true", code, resp.Found)
	}
	if len(resp.Nodes) != 2 || resp.Nodes[1].Name != "Bravo" {
		t.Fatalf("A→B path = %+v, want [A, Bravo]", resp.Nodes)
	}
	if len(resp.Hops) != 1 {
		t.Fatalf("A→B hops = %d, want 1", len(resp.Hops))
	}

	// Malformed pubkeys are rejected.
	if code, _ := get("from=nope&to=" + ids[0xb0]); code != http.StatusBadRequest {
		t.Errorf("bad from: code = %d, want 400", code)
	}
}

// hexHash builds a distinct packet hash per (i, tag) so each observation counts
// as a separate packet-link event. The hash is opaque to ObservePath (any
// non-empty string works), so uniqueness is all that matters.
func hexHash(i int64, tag string) string {
	return fmt.Sprintf("%s-%d", tag, i)
}
