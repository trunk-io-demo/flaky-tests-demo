import Testing

// Kept apart from UploadShapes because this one is a warning rather than a
// shape: every argument collapses into a single <testcase>. See ../README.md.

@Suite("swift parameterized shapes") struct ParameterizedShapes {
    @Test("one testcase for three arguments", arguments: [1, 2, 3])
    func collapsesToOneTestcase(value: Int) {
        #expect(value % 2 == 0, "value \(value) is odd")
    }
}
