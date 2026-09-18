import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)) + r"\..")

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?", 1)[0]
        full = super().translate_path(p)
        if not os.path.isfile(full):
            return super().translate_path("/index.html")
        return full

http.server.HTTPServer(("localhost", 5502), Handler).serve_forever()
