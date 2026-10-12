package com.hermes.backend.infrastructure.web;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Which connections are reverse proxies whose {@code X-Forwarded-For} header can be believed.
 *
 * <p>A client can send any {@code X-Forwarded-For} it likes. The header is only worth reading when it was added by a proxy
 * of ours, and then only the part the proxy added: its right-hand end. {@link RequestIpResolver} asks this class whether the
 * connection (and each address in the header, from the right) belongs to such a proxy. Everything else is the client.</p>
 *
 * <p>The setting {@code app.security.trusted-proxies} ({@code APP_TRUSTED_PROXIES}) is a list separated by commas or spaces
 * of addresses, ranges ({@code 10.0.0.0/8}, {@code fd00::/8}) and these words:</p>
 * <ul>
 *   <li>{@code private}: loopback, private, shared (carrier-grade NAT), link-local and unique-local addresses. These are
 *       never clients of the open internet, which is where a proxy in front of the app connects from. This is the default.</li>
 *   <li>{@code loopback}: {@code 127.0.0.0/8} and {@code ::1} only.</li>
 *   <li>{@code none}: no proxy is trusted, every header is ignored (an app that is reached directly).</li>
 *   <li>{@code all}: every connection is a proxy, and the last address in the header is the client. Only right when the app can
 *       be reached through the proxy alone and the proxy adds the address of its client to the header; a proxy that passes a
 *       client's header on untouched makes this as open as no check at all.</li>
 * </ul>
 */
public final class TrustedProxies {

    /** Addresses that are not clients of the open internet. */
    static final List<String> PRIVATE_RANGES = List.of(
            "127.0.0.0/8", "::1/128",
            "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
            "100.64.0.0/10",
            "169.254.0.0/16", "fe80::/10",
            "fc00::/7");

    private static final Pattern IPV4 = Pattern.compile("(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})");
    private static final Pattern IPV6_CHARACTERS = Pattern.compile("[0-9A-Fa-f:.]+");

    public static final TrustedProxies DEFAULT = parse("private");
    public static final TrustedProxies NONE = parse("none");

    private final boolean everyPeer;
    private final List<Range> ranges;
    private final String description;

    private TrustedProxies(boolean everyPeer, List<Range> ranges, String description) {
        this.everyPeer = everyPeer;
        this.ranges = List.copyOf(ranges);
        this.description = description;
    }

    /**
     * @throws IllegalArgumentException for an entry that is not an address, a range or one of the words above: a mistake in
     *         this setting should stop the app from starting, not quietly change who is believed
     */
    public static TrustedProxies parse(String spec) {
        String text = spec == null ? "" : spec.trim();
        List<Range> ranges = new ArrayList<>();
        boolean every = false;
        for (String raw : text.split("[,;\\s]+")) {
            String entry = raw.trim();
            if (entry.isEmpty()) continue;
            switch (entry.toLowerCase(Locale.ROOT)) {
                case "none" -> { }
                case "all", "*" -> every = true;
                case "private" -> PRIVATE_RANGES.forEach(range -> ranges.add(Range.parse(range)));
                case "loopback" -> {
                    ranges.add(Range.parse("127.0.0.0/8"));
                    ranges.add(Range.parse("::1/128"));
                }
                default -> ranges.add(Range.parse(entry));
            }
        }
        return new TrustedProxies(every, ranges, text.isEmpty() ? "none" : text);
    }

    /** True when the address is a proxy of ours. */
    public boolean trusts(InetAddress address) {
        if (address == null) return false;
        if (everyPeer) return true;
        for (Range range : ranges) {
            if (range.contains(address)) return true;
        }
        return false;
    }

    /** True when every connection counts as a proxy, so the last address in the header is the client. */
    public boolean trustsEveryPeer() {
        return everyPeer;
    }

    @Override
    public String toString() {
        return description;
    }

    /**
     * The address a text names, or null when it is not an IP address written out in digits. A host name is never looked up: a
     * header comes from a client, and a name in it would make the app do the client's DNS queries.
     */
    public static InetAddress literal(String text) {
        if (text == null) return null;
        String value = text.trim();
        int zone = value.indexOf('%');
        if (zone >= 0) value = value.substring(0, zone);
        if (value.isEmpty()) return null;
        try {
            if (value.indexOf(':') >= 0) {
                if (!IPV6_CHARACTERS.matcher(value).matches()) return null;
                return InetAddress.getByName(value);
            }
            var matcher = IPV4.matcher(value);
            if (!matcher.matches()) return null;
            byte[] bytes = new byte[4];
            for (int i = 0; i < 4; i++) {
                int part = Integer.parseInt(matcher.group(i + 1));
                if (part > 255) return null;
                bytes[i] = (byte) part;
            }
            return InetAddress.getByAddress(bytes);
        } catch (UnknownHostException | NumberFormatException notAnAddress) {
            return null;
        }
    }

    /** An address or a range: {@code 203.0.113.7}, {@code 10.0.0.0/8}, {@code fd00::/8}. */
    private record Range(byte[] base, int prefixBits) {

        static Range parse(String text) {
            String entry = text.trim();
            int slash = entry.indexOf('/');
            String addressText = slash < 0 ? entry : entry.substring(0, slash);
            InetAddress address = literal(addressText);
            if (address == null) {
                throw new IllegalArgumentException("Not an address, a range or a known word in the trusted proxies setting: '" + text + "'");
            }
            byte[] base = address.getAddress();
            int bits = base.length * 8;
            if (slash >= 0) {
                try {
                    bits = Integer.parseInt(entry.substring(slash + 1).trim());
                } catch (NumberFormatException broken) {
                    throw new IllegalArgumentException("Not a range in the trusted proxies setting: '" + text + "'");
                }
                if (bits < 0 || bits > base.length * 8) {
                    throw new IllegalArgumentException("A range of " + base.length * 8 + "-bit addresses has 0 to " + base.length * 8 + " bits: '" + text + "'");
                }
            }
            return new Range(base, bits);
        }

        boolean contains(InetAddress address) {
            byte[] candidate = address.getAddress();
            if (candidate.length != base.length) return false;
            int whole = prefixBits / 8;
            for (int i = 0; i < whole; i++) {
                if (candidate[i] != base[i]) return false;
            }
            int rest = prefixBits % 8;
            if (rest == 0) return true;
            int mask = (0xFF << (8 - rest)) & 0xFF;
            return (candidate[whole] & mask) == (base[whole] & mask);
        }
    }
}
