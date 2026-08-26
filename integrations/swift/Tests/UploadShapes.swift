import Testing

// One test per JUnit result shape Swift Testing can emit. See ../README.md.
//
// Keep a blank line between a comment and the @Test or @Suite below it: Swift
// Testing reads a contiguous preceding comment as a test comment and reprints
// it under every failure.

@Suite("swift upload shapes") struct UploadShapes {
    @Test("passes") func passes() {
        #expect(1 + 1 == 2)
    }

    @Test("fails on characters that have to survive XML escaping")
    func hostileCharacters() {
        let payload = #"<tag attr="v"> & 'quoted' ünïcode → 😀"#
        #expect(payload == "plain", "payload was \(payload)")
    }

    @Test("is skipped", .disabled("demonstrates <skipped> in the report"))
    func skipped() {
        #expect(Bool(false))
    }

    @Test("passes because the issue is known") func knownIssue() {
        withKnownIssue("demonstrates a known issue reporting as a pass") {
            #expect(Bool(false))
        }
    }
}
