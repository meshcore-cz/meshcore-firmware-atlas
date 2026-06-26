package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// LiveAdvert is the compact advert frame pushed to browsers over the live
// WebSocket. It is intentionally small — the map only needs identity, type and a
// location to draw a pulse. Coordinates are sent when the advert itself carried
// GPS; the frontend falls back to the node's last known position otherwise.
type LiveAdvert struct {
	Kind      string  `json:"kind"` // always "advert" (room for future frame types)
	PubKey    string  `json:"pubkey"`
	Name      string  `json:"name,omitempty"`
	Type      byte    `json:"type"`
	HasGPS    bool    `json:"hasGps"`
	Lat       float64 `json:"lat,omitempty"`
	Lon       float64 `json:"lon,omitempty"`
	NetworkID string  `json:"networkId,omitempty"`
	At        int64   `json:"at"`
	New       bool    `json:"new"` // first advert ever seen from this node
}

// Live WebSocket tuning. The per-client buffer is deliberately small: a browser
// that can't keep up drops frames (adverts are ephemeral) rather than stalling
// the broadcast for everyone.
const (
	liveSendBuffer   = 64
	liveWriteWait    = 10 * time.Second
	livePongWait     = 60 * time.Second
	livePingInterval = 30 * time.Second
)

// Hub fans out live adverts to every connected browser. Broadcast is called on
// the hot advert path, so it marshals once and never blocks: a slow client
// simply misses frames.
type Hub struct {
	mu       sync.RWMutex
	clients  map[*liveClient]struct{}
	upgrader websocket.Upgrader
}

type liveClient struct {
	send chan []byte
}

func newHub() *Hub {
	return &Hub{
		clients: make(map[*liveClient]struct{}),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 4096,
			// The feed is public and read-only (the REST API already sets
			// Access-Control-Allow-Origin: *), so any origin may subscribe.
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// Broadcast pushes one advert to every subscriber. It returns immediately if no
// one is listening and never blocks on a slow client.
func (h *Hub) Broadcast(a LiveAdvert) {
	a.Kind = "advert"
	h.mu.RLock()
	defer h.mu.RUnlock()
	if len(h.clients) == 0 {
		return
	}
	msg, err := json.Marshal(a)
	if err != nil {
		return
	}
	for c := range h.clients {
		select {
		case c.send <- msg:
		default: // client is behind — drop this frame rather than stall the mesh
		}
	}
}

func (h *Hub) add(c *liveClient) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	n := len(h.clients)
	h.mu.Unlock()
	log.Printf("live: client connected (%d total)", n)
}

func (h *Hub) remove(c *liveClient) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
	n := len(h.clients)
	h.mu.Unlock()
	log.Printf("live: client disconnected (%d total)", n)
}

// ServeWS upgrades the request to a WebSocket and serves the live advert feed
// until the client goes away. It must be mounted outside the gzip middleware —
// the upgrade hijacks the underlying connection.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return // Upgrade already wrote an error response
	}
	c := &liveClient{send: make(chan []byte, liveSendBuffer)}
	h.add(c)
	go h.writePump(conn, c)
	h.readPump(conn, c)
}

// readPump drains incoming frames (we expect none beyond control frames) so the
// connection's pong/close handling stays live. Its return tears the client down.
func (h *Hub) readPump(conn *websocket.Conn, c *liveClient) {
	defer func() {
		h.remove(c)
		conn.Close()
	}()
	conn.SetReadLimit(512)
	_ = conn.SetReadDeadline(time.Now().Add(livePongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(livePongWait))
	})
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

// writePump flushes queued adverts and keeps the connection warm with pings.
func (h *Hub) writePump(conn *websocket.Conn, c *liveClient) {
	ticker := time.NewTicker(livePingInterval)
	defer func() {
		ticker.Stop()
		conn.Close() // unblock readPump if the write side failed first
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = conn.SetWriteDeadline(time.Now().Add(liveWriteWait))
			if !ok { // hub closed the channel: the client is being removed
				_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(liveWriteWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
