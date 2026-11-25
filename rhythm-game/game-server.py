#!/usr/bin/env python3
"""Serve the rhythm game locally and open it in the browser.

Usage:  python3 game-server.py [port]     (default port: 8000)
"""
import functools
import http.server
import os
import sys
import threading
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Static file handler that disables caching so edits show up on refresh."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".json": "application/json",
        ".mp3": "audio/mpeg",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("localhost", PORT), handler)
    url = f"http://localhost:{PORT}/index.html"
    print(f"Serving {ROOT}\nGame running at {url}  (Ctrl+C to stop)")
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
