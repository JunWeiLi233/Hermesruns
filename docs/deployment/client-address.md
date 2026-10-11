# Client address behind a proxy (`APP_TRUSTED_PROXIES`)

The app counts things per address: wrong passwords (ten lock an address out), sign-ups (eight an hour), requests per
minute, webhook calls, the traffic monitor, the admin audit log. Behind a reverse proxy the connection comes from the
proxy, so the client's address has to be read from `X-Forwarded-For`. Anybody can write that header, so it is only read
when it was added by a proxy of ours.

## The rule

- A connection from an address that is **not** a trusted proxy is the client. Its `X-Forwarded-For` and `X-Real-IP` are
  ignored.
- A connection from a trusted proxy is read from the **right** of `X-Forwarded-For`: the last address that is not itself a
  trusted proxy is the client. The left of the header is whatever the client chose to write and is never read.
- An entry that is not an address (a name, text, a port) where the proxy's own entry should be makes the app fall back to
  the connection's address. Names are never looked up.
- If every address in the header is a trusted proxy, the first one is used (the client is inside the network).

Before this rule the first address in the header was the client, whoever sent it, so every request could claim to be a new
address: ten wrong passwords never locked anyone out, and the sign-up cap and the request limits did nothing (BUG-001).

## The setting

`APP_TRUSTED_PROXIES` (property `app.security.trusted-proxies`) is a list, separated by commas or spaces, of addresses,
ranges and these words. The default is `private`.

| Entry | Meaning |
| --- | --- |
| `private` | loopback, private (`10/8`, `172.16/12`, `192.168/16`), shared (`100.64/10`), link-local and unique-local (`fc00::/7`) addresses: where a proxy in front of the app connects from on one host, in one private network, or in a platform's internal network |
| `loopback` | `127.0.0.0/8` and `::1` only: a proxy on the same machine |
| `none` | no proxy is trusted and every header is ignored: the app is reached directly |
| `all` | every connection is a proxy and the last address is the client. Only when the proxy is the one way in **and** adds its client's address to the header; a proxy that passes a client's header on untouched makes this as open as no check |
| `203.0.113.7`, `10.1.0.0/16`, `fd00::/8` | one address or a range |

An entry that is none of these stops the app from starting. A typo does not quietly change who is believed. The app logs
what it believes at start-up: `X-Forwarded-For is believed from: private`.

## Which value

- **The app is reached directly** (no proxy, a test stack, a laptop): `none`.
- **A proxy on the same machine** (nginx, Caddy): `loopback`, or leave the default.
- **Railway, Docker, Kubernetes behind their own ingress**: leave the default; their proxies connect from internal
  addresses. Run the check below once after deploying, because how a platform builds the header is the platform's to say.
- **A proxy or CDN that connects from public addresses** (Cloudflare in front of the platform, a load balancer with a public
  address): name its ranges next to `private`, so the walk steps over them to the client:
  `APP_TRUSTED_PROXIES=private,<the provider's published ranges>`. Cloudflare publishes its list at
  <https://www.cloudflare.com/ips/>. Without them every visitor behind the same edge address is one client for the limits.

## Check it from outside

The same request with a different made-up `X-Forwarded-For` each time must still be limited as one client (the limit on
`/api/auth/*` is 60 a minute):

```bash
for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code} " -H "X-Forwarded-For: 10.9.9.$i" https://YOUR-HOST/api/auth/password-rules; done; echo
```

Expect `200` about sixty times, then `429`. All `200` means the header is being believed from the open internet: the proxy
passes the client's header on without adding the client's address, or `all` is set where it should not be.

## Notes

- Spring's `ForwardedHeaderFilter` (`server.forward-headers-strategy=framework`) still rewrites scheme, host, port and prefix
  from the proxy's headers. It also makes `getRemoteAddr()` the first address in `X-Forwarded-For`, so `ClientAddressFilter`
  writes the connection's own address and the header down first (request attributes only the server can set), and the
  resolver reads those. The filter is registered in `ClientAddressConfiguration`, one place after the address filter; Spring
  Boot's own registration of it backs off. `ClientAddressConfigurationTests` holds that arrangement.
- `X-Forwarded-Proto` decides only whether cookies get the `Secure` flag and whether plain HTTP is redirected; it is not
  part of the address.
- The localhost-only checks (the local console error endpoint) use the connection's own address and no header.
