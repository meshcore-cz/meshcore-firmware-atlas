package main

import "testing"

// TestMergedSearchIncludesImported confirms /api/search surfaces directory-only
// nodes, dedupes them against live ones (live wins), and tags each hit's source.
func TestMergedSearchIncludesImported(t *testing.T) {
	r := newTestRegistry() // seeds bb01 "London Sensor" as a live node
	ir := newImportRegistry()
	ir.Replace([]*ImportedNode{
		// Directory-only node — must appear in results, tagged source "map".
		importedNode("ee01", "Berlin Imported", 2, 52.52, 13.40),
		// Duplicate of the live bb01 — the live node must win, the import dropped.
		importedNode("bb01", "London Dup", 4, 51.50, -0.12),
	})
	s := &Server{nodes: r, imported: ir}

	results, total, _ := s.mergedSearch(MapParams{}, 50)

	bySource := map[string]string{} // pubkey -> source
	for _, res := range results {
		if prev, dup := bySource[res.PubKey]; dup {
			t.Fatalf("pubkey %s returned twice (sources %q and %q)", res.PubKey, prev, res.Source)
		}
		bySource[res.PubKey] = res.Source
	}

	if bySource["ee01"] != "map" {
		t.Errorf("imported node ee01 source = %q, want map", bySource["ee01"])
	}
	if bySource["bb01"] != "live" {
		t.Errorf("duplicate bb01 source = %q, want live (live wins)", bySource["bb01"])
	}
	// 5 live seeds (aa01-03, bb01, cc01) + 1 directory-only (ee01) = 6.
	if total != 6 {
		t.Fatalf("total = %d, want 6 (5 live + 1 imported)", total)
	}
}

// TestMergedSearchQueryMatchesImportedName ensures a name query reaches the
// imported directory, not just the live registry.
func TestMergedSearchQueryMatchesImportedName(t *testing.T) {
	r := newNodeRegistry(defaultAdvertsPerNode)
	ir := newImportRegistry()
	ir.Replace([]*ImportedNode{importedNode("ee01", "Lonely Map Node", 2, 1, 1)})
	s := &Server{nodes: r, imported: ir}

	results, total, _ := s.mergedSearch(MapParams{Q: "lonely"}, 50)
	if total != 1 || len(results) != 1 || results[0].PubKey != "ee01" {
		t.Fatalf("got %d results (total %d), want the single imported ee01", len(results), total)
	}
	if results[0].Source != "map" {
		t.Errorf("source = %q, want map", results[0].Source)
	}
}

// TestHistorySigIgnoresLastAdvert confirms a sync that only advances last_advert
// is the same publish (same sig), while a name change is a new publish.
func TestHistorySigIgnoresLastAdvert(t *testing.T) {
	base := &ImportedNode{PublicKey: "ee01", AdvName: "Node", Type: 2, AdvLat: 1, AdvLon: 2, UpdatedDate: "2026-01-01T00:00:00Z"}
	base.cacheDerived()

	advanced := *base
	advanced.LastAdvert = "2026-06-29T12:00:00Z"
	advanced.cacheDerived()
	if base.historySig() != advanced.historySig() {
		t.Error("changing only last_advert produced a new sig; should be the same publish")
	}

	renamed := *base
	renamed.AdvName = "Renamed"
	if base.historySig() == renamed.historySig() {
		t.Error("changing adv_name kept the same sig; should be a new publish")
	}
}
