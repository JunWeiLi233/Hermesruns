package com.hermes.backend.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * Who is the client behind a request. The address is the connection's own unless the connection is a proxy of ours, and then it is
 * the last address in X-Forwarded-For that is not one of ours: a header a client wrote itself must never make it somebody else.
 */
class RequestIpResolverTests {

    private static final String PUBLIC_CLIENT = "203.0.113.7";
    private static final String OTHER_PUBLIC = "198.51.100.9";

    @AfterEach
    void backToTheDefault() {
        RequestIpResolver.configure(TrustedProxies.DEFAULT);
    }

    private static MockHttpServletRequest from(String peer, String... forwardedLines) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        for (String line : forwardedLines) {
            request.addHeader("X-Forwarded-For", line);
        }
        return request;
    }

    // ---- a client that reaches the app itself --------------------------------------------------------------------------------

    @Test
    void aDirectClientIsItsConnectionWhateverTheHeaderSays() {
        assertThat(RequestIpResolver.clientIp(from(PUBLIC_CLIENT, "10.9.9.9"))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from(PUBLIC_CLIENT, OTHER_PUBLIC, "1.2.3.4"))).isEqualTo(PUBLIC_CLIENT);
    }

    @Test
    void aClientCannotBecomeSomebodyNewByChangingTheHeader() {
        String first = RequestIpResolver.clientIp(from(PUBLIC_CLIENT, "10.0.0.1"));
        String second = RequestIpResolver.clientIp(from(PUBLIC_CLIENT, "10.0.0.2"));
        String third = RequestIpResolver.clientIp(from(PUBLIC_CLIENT));
        assertThat(first).isEqualTo(second).isEqualTo(third).isEqualTo(PUBLIC_CLIENT);
    }

    @Test
    void xRealIpIsNotReadAtAll() {
        MockHttpServletRequest request = from(PUBLIC_CLIENT);
        request.addHeader("X-Real-IP", OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(request)).isEqualTo(PUBLIC_CLIENT);
        MockHttpServletRequest viaProxy = from("10.0.0.5");
        viaProxy.addHeader("X-Real-IP", OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(viaProxy)).isEqualTo("10.0.0.5");
    }

    // ---- a client behind a proxy of ours -------------------------------------------------------------------------------------

    @Test
    void behindAProxyTheClientIsWhatTheProxyAdded() {
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("192.168.1.20", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("100.64.3.4", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("172.20.0.2", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
    }

    @Test
    void whatTheClientWroteOnTheLeftIsNeverRead() {
        // The client sent "10.9.9.9"; the proxy appended the address it really got the request from.
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "10.9.9.9, " + PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", OTHER_PUBLIC + ", " + PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
    }

    @Test
    void aChainOfOurOwnProxiesIsSkippedFromTheRight() {
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT + ", 10.1.1.1, 172.16.4.4"))).isEqualTo(PUBLIC_CLIENT);
        // Spread over several header lines, as some proxies add them: read in order, as one list.
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", OTHER_PUBLIC, PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "1.1.1.1, " + OTHER_PUBLIC, PUBLIC_CLIENT + ", 10.2.2.2"))).isEqualTo(PUBLIC_CLIENT);
    }

    @Test
    void whenEveryHopIsOursTheClientIsInsideAndTheFirstAddressIsTheOneTheFirstProxySaw() {
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "192.168.1.9, 10.1.1.1"))).isEqualTo("192.168.1.9");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "10.4.4.4"))).isEqualTo("10.4.4.4");
    }

    @Test
    void aProxyWithNoHeaderIsItsOwnClient() {
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", "  ,  "))).isEqualTo("127.0.0.1");
    }

    @Test
    void anEntryThatIsNotAnAddressMakesTheHeaderUnreadable() {
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT + ", not-an-address"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "unknown"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "evil.example.com"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "1.2.3"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "300.1.1.1"))).isEqualTo("10.0.0.5");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "1.2.3.4:8080"))).isEqualTo("10.0.0.5");
        // Garbage on the left, behind an address the proxy did write, is not looked at.
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "<script>, ::zzz, " + PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
    }

    // ---- IPv6 ----------------------------------------------------------------------------------------------------------------

    @Test
    void ipv6AddressesAreRead() {
        assertThat(RequestIpResolver.clientIp(from("2001:db8::1", "10.0.0.1"))).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(RequestIpResolver.clientIp(from("fd12:3456::7", "2001:db8::99"))).isEqualTo("2001:db8:0:0:0:0:0:99");
        assertThat(RequestIpResolver.clientIp(from("0:0:0:0:0:0:0:1", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("fe80::1%eth0", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        // An IPv4 address written as IPv6 is the IPv4 address.
        assertThat(RequestIpResolver.clientIp(from("::ffff:10.0.0.5", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", "::ffff:203.0.113.7"))).isEqualTo(PUBLIC_CLIENT);
    }

    // ---- no connection to speak of -------------------------------------------------------------------------------------------

    @Test
    void withoutAConnectionAddressNobodyIsKnown() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("");
        request.addHeader("X-Forwarded-For", PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(request)).isEqualTo("unknown");
        assertThat(RequestIpResolver.clientIp(null)).isEqualTo("unknown");
    }

    // ---- the setting ---------------------------------------------------------------------------------------------------------

    @Test
    void noneBelievesNoHeaderEvenFromThisMachine() {
        RequestIpResolver.configure(TrustedProxies.parse("none"));
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", PUBLIC_CLIENT))).isEqualTo("127.0.0.1");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT))).isEqualTo("10.0.0.5");
    }

    @Test
    void anEmptySettingTrustsNobody() {
        RequestIpResolver.configure(TrustedProxies.parse(""));
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT))).isEqualTo("10.0.0.5");
    }

    @Test
    void aNamedRangeIsTheOnlyProxy() {
        RequestIpResolver.configure(TrustedProxies.parse("203.0.113.0/24, 2001:db8:ffff::/48"));
        assertThat(RequestIpResolver.clientIp(from("203.0.113.40", OTHER_PUBLIC))).isEqualTo(OTHER_PUBLIC);
        // This machine and the private ranges are not named, so a header from them is the client's own.
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", OTHER_PUBLIC))).isEqualTo("127.0.0.1");
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", OTHER_PUBLIC))).isEqualTo("10.0.0.5");
        // A proxy of ours in the chain is skipped, one that is not named is a client.
        assertThat(RequestIpResolver.clientIp(from("203.0.113.40", OTHER_PUBLIC + ", 203.0.113.41"))).isEqualTo(OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(from("2001:db8:ffff::5", OTHER_PUBLIC))).isEqualTo(OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(from("2001:db8:fffe::5", OTHER_PUBLIC))).isEqualTo("2001:db8:fffe:0:0:0:0:5");
    }

    @Test
    void anAddressAloneIsAHostRange() {
        RequestIpResolver.configure(TrustedProxies.parse("198.51.100.4"));
        assertThat(RequestIpResolver.clientIp(from("198.51.100.4", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("198.51.100.5", PUBLIC_CLIENT))).isEqualTo("198.51.100.5");
    }

    @Test
    void loopbackAloneLeavesThePrivateRangesOut() {
        RequestIpResolver.configure(TrustedProxies.parse("loopback"));
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("::1", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", PUBLIC_CLIENT))).isEqualTo("10.0.0.5");
    }

    @Test
    void allTakesTheLastAddressOfTheHeaderFromAnyConnection() {
        RequestIpResolver.configure(TrustedProxies.parse("all"));
        assertThat(RequestIpResolver.clientIp(from(PUBLIC_CLIENT, "10.9.9.9, " + OTHER_PUBLIC))).isEqualTo(OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(from(PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from(PUBLIC_CLIENT, "garbage"))).isEqualTo(PUBLIC_CLIENT);
        assertThat(TrustedProxies.parse("*").trustsEveryPeer()).isTrue();
    }

    @Test
    void wordsCanBeMixedWithRanges() {
        RequestIpResolver.configure(TrustedProxies.parse("Loopback; 203.0.113.0/24 NONE"));
        assertThat(RequestIpResolver.clientIp(from("127.0.0.1", OTHER_PUBLIC))).isEqualTo(OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(from("203.0.113.9", OTHER_PUBLIC))).isEqualTo(OTHER_PUBLIC);
        assertThat(RequestIpResolver.clientIp(from("10.0.0.5", OTHER_PUBLIC))).isEqualTo("10.0.0.5");
    }

    @Test
    void aMistakeInTheSettingStopsTheAppRatherThanChangeWhoIsBelieved() {
        assertThatThrownBy(() -> TrustedProxies.parse("10.0.0.0/8, my-proxy.internal"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("my-proxy.internal");
        assertThatThrownBy(() -> TrustedProxies.parse("10.0.0.0/33")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TrustedProxies.parse("10.0.0.0/x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TrustedProxies.parse("fd00::/129")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TrustedProxies.parse("10.0.0/8")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void thePrivateWordCoversTheRangesAProxyConnectsFromAndNothingElse() {
        TrustedProxies proxies = TrustedProxies.DEFAULT;
        for (String inside : new String[] {"127.0.0.1", "127.255.255.254", "10.0.0.0", "10.255.255.255", "172.16.0.1", "172.31.255.255",
                "192.168.0.1", "192.168.255.255", "100.64.0.1", "100.127.255.255", "169.254.1.1", "::1", "fe80::1", "fd12:3456:789a::1", "fc00::1"}) {
            assertThat(proxies.trusts(TrustedProxies.literal(inside))).as(inside).isTrue();
        }
        for (String outside : new String[] {"8.8.8.8", "172.15.255.255", "172.32.0.0", "192.169.0.1", "100.63.255.255", "100.128.0.0", "11.0.0.1",
                "169.253.1.1", "2001:db8::1", "2606:4700::1111", "fe00::1", "fb00::1"}) {
            assertThat(proxies.trusts(TrustedProxies.literal(outside))).as(outside).isFalse();
        }
    }

    @Test
    void aHostNameIsNeverLookedUp() {
        for (String name : new String[] {"localhost", "example.com", "a.b.c.d", "1.2.3.4.5", "0x7f.0.0.1", "127.1", "::g", "12345", "", "  "}) {
            assertThat(TrustedProxies.literal(name)).as(name).isNull();
        }
        assertThat(TrustedProxies.literal(" 203.0.113.7 ")).isNotNull();
    }

    @Test
    void theStartUpConfigurationAppliesTheSetting() {
        new ClientAddressConfiguration("10.20.0.0/16").configure();
        assertThat(RequestIpResolver.configured().toString()).isEqualTo("10.20.0.0/16");
        assertThat(RequestIpResolver.clientIp(from("10.20.1.1", PUBLIC_CLIENT))).isEqualTo(PUBLIC_CLIENT);
        assertThat(RequestIpResolver.clientIp(from("10.30.1.1", PUBLIC_CLIENT))).isEqualTo("10.30.1.1");
    }
}
