import urllib.request, urllib.parse, json, subprocess, time, base64, os, sys, struct, socket, http.server, socketserver, threading

PORT = 8089

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def take_element_screenshot(selector, output_path, click_selector=None, width=1440, height=1200):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    profile_dir = os.path.join(os.environ['TEMP'], f'edge_shot_{int(time.time()*1000)%100000}')
    cdp_port = 9230
    
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={cdp_port}',
        f'--user-data-dir={profile_dir}',
        f'--window-size={width},{height}',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ])
    try:
        time.sleep(1.5)
        target_url = f'http://127.0.0.1:{PORT}/index.html'
        req = urllib.request.Request(
            f'http://127.0.0.1:{cdp_port}/json/new?{target_url}',
            method='PUT'
        )
        with urllib.request.urlopen(req) as r:
            new_tab = json.loads(r.read())
            ws_url = new_tab['webSocketDebuggerUrl']
        
        # parse ws_url: ws://127.0.0.1:9230/devtools/page/...
        parsed = urllib.parse.urlparse(ws_url)
        path = parsed.path
        
        s = socket.create_connection(('127.0.0.1', cdp_port))
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        handshake = (
            f'GET {path} HTTP/1.1\r\n'
            f'Host: 127.0.0.1:{cdp_port}\r\n'
            f'Upgrade: websocket\r\n'
            f'Connection: Upgrade\r\n'
            f'Sec-WebSocket-Key: {key}\r\n'
            f'Sec-WebSocket-Version: 13\r\n\r\n'
        )
        s.sendall(handshake.encode('ascii'))
        resp = s.recv(4096)
        
        msg_id = 1
        def call_cdp(method, params=None):
            nonlocal msg_id
            mid = msg_id
            msg_id += 1
            payload = json.dumps({'id': mid, 'method': method, 'params': params or {}})
            data = payload.encode('utf-8')
            length = len(data)
            mask = os.urandom(4)
            masked = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
            if length <= 125:
                header = struct.pack('!BB', 0x81, 0x80 | length)
            elif length <= 65535:
                header = struct.pack('!BBH', 0x81, 0x80 | 126, length)
            else:
                header = struct.pack('!BBQ', 0x81, 0x80 | 127, length)
            s.sendall(header + mask + masked)
            
            while True:
                h = s.recv(2)
                if not h: return None
                b1, b2 = h[0], h[1]
                l = b2 & 0x7f
                if l == 126:
                    l = struct.unpack('!H', s.recv(2))[0]
                elif l == 127:
                    l = struct.unpack('!Q', s.recv(8))[0]
                chunk = bytearray()
                while len(chunk) < l:
                    chunk.extend(s.recv(l - len(chunk)))
                msg = json.loads(chunk.decode('utf-8', errors='ignore'))
                if msg.get('id') == mid:
                    return msg.get('result', {})

        call_cdp('Page.enable')
        time.sleep(1)

        if click_selector:
            escaped_sel = json.dumps(click_selector)
            click_eval = call_cdp('Runtime.evaluate', {
                'expression': f"""(() => {{
                    const el = document.querySelector({escaped_sel});
                    if (!el) return 'NOT_FOUND: ' + {escaped_sel};
                    el.click();
                    return 'CLICKED: ' + el.outerHTML;
                }})()""",
                'returnByValue': True
            })
            print('Click eval result:', click_eval)
            time.sleep(0.5)

        # Get bounding box of selector
        eval_res = call_cdp('Runtime.evaluate', {
            'expression': f"""
                (() => {{
                    const el = document.querySelector('{selector}');
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return {{x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height}};
                }})()
            """,
            'returnByValue': True
        })
        rect = eval_res.get('result', {}).get('value')
        if not rect:
            print('Element not found:', selector)
            return False

        clip = {
            'x': max(0, rect['x'] - 10),
            'y': max(0, rect['y'] - 10),
            'width': rect['width'] + 20,
            'height': rect['height'] + 20,
            'scale': 1
        }
        snap = call_cdp('Page.captureScreenshot', {
            'clip': clip,
            'captureBeyondViewport': True
        })
        b64data = snap.get('data')
        if b64data:
            with open(output_path, 'wb') as f:
                f.write(base64.b64decode(b64data))
            print('Screenshot saved successfully to:', output_path)
            return True
    finally:
        try:
            s.close()
        except:
            pass
        proc.kill()
        httpd.shutdown()

if __name__ == '__main__':
    sel = sys.argv[1] if len(sys.argv) > 1 else '.rooms-section'
    out = sys.argv[2] if len(sys.argv) > 2 else 'screenshot_rooms_dog.png'
    click = sys.argv[3] if len(sys.argv) > 3 else None
    take_element_screenshot(sel, out, click)
