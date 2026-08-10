"""개발용 정적 서버 — 캐시 없이 항상 최신 파일을 준다.

`python3 -m http.server` 는 Cache-Control 헤더를 보내지 않아서
브라우저가 휴리스틱 캐시로 낡은 JS/HTML을 섞어 쓰는 사고가 난다
(서비스 워커의 네트워크 우선 전략도 HTTP 캐시 위에서 동작하므로 같이 속는다).
프로덕션(Vercel)은 재검증 헤더를 제대로 보내므로 이 문제가 없다 — 개발 전용 도구.

사용법:
    python3 scripts/dev_server.py [포트]   # 기본 8000
"""

import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """모든 응답에 no-store 를 붙이는 핸들러."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    address = ("", port)
    print(f"줍줍! 개발 서버 → http://localhost:{port} (캐시 없음)")
    http.server.ThreadingHTTPServer(address, NoCacheHandler).serve_forever()


if __name__ == "__main__":
    main()
