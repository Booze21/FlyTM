@app.route("/connect")
def connect():
    cfg = request.args.get("cfg")

    if not cfg:
        return abort(400)

    link = f"v2raytun://import/{cfg}"

    return f"""
    <html>
    <head>
        <title>VPN Connect</title>
        <script>
            function openApp() {{
                window.location.href = "{link}";
            }}

            setTimeout(openApp, 500);
        </script>
    </head>
    <body style="text-align:center; font-family:sans-serif;">
        <h2>🚀 Подключаем VPN...</h2>
        <p>Если не открылось автоматически:</p>
        <button onclick="openApp()" style="padding:15px;font-size:18px;">
            Открыть VPN
        </button>
    </body>
    </html>
    """
