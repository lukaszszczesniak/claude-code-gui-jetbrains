package com.github.yhk1038.claudecodegui.bridge

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class ShellPathResolverTest {

    @Nested
    inner class ExtractBetweenMarkers {
        @Test
        fun `should extract the PATH sandwiched between two markers`() {
            val marker = "abc123"
            val output = "noise before${marker}/usr/local/bin:/usr/bin:/bin${marker}noise after"
            assertEquals("/usr/local/bin:/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should trim surrounding whitespace and newlines`() {
            val marker = "M"
            val output = "${marker}\n  /usr/bin:/bin  \n${marker}"
            assertEquals("/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should ignore shell startup noise outside the markers`() {
            val marker = "ZZ"
            // Simulates a noisy interactive shell: banner + prompt then the marked PATH.
            val output = "Welcome to zsh!\n[32m➜[0m ${marker}/opt/homebrew/bin:/usr/bin${marker}\nbye"
            assertEquals("/opt/homebrew/bin:/usr/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should return null when markers are absent`() {
            assertNull(ShellPathResolver.extractBetweenMarkers("/usr/bin:/bin", "M"))
        }

        @Test
        fun `should return null when only one marker is present`() {
            assertNull(ShellPathResolver.extractBetweenMarkers("M/usr/bin:/bin", "M"))
        }

        @Test
        fun `should take the first marker pair only`() {
            val marker = "Q"
            val output = "${marker}/first:/path${marker}middle${marker}/second${marker}"
            assertEquals("/first:/path", ShellPathResolver.extractBetweenMarkers(output, marker))
        }

        @Test
        fun `should handle a marker that contains regex-special characters`() {
            val marker = "a.b*c+"
            val output = "${marker}/usr/bin:/bin${marker}"
            assertEquals("/usr/bin:/bin", ShellPathResolver.extractBetweenMarkers(output, marker))
        }
    }

    @Nested
    inner class LooksLikePath {
        @Test
        fun `should accept a colon-separated PATH`() {
            assertTrue(ShellPathResolver.looksLikePath("/usr/local/bin:/usr/bin:/bin"))
        }

        @Test
        fun `should reject a single directory without colon`() {
            assertFalse(ShellPathResolver.looksLikePath("/usr/bin"))
        }

        @Test
        fun `should reject blank or null`() {
            assertFalse(ShellPathResolver.looksLikePath(null))
            assertFalse(ShellPathResolver.looksLikePath(""))
            assertFalse(ShellPathResolver.looksLikePath("   "))
        }
    }

    @Nested
    inner class BuildShellCommand {
        @Test
        fun `should wrap printenv PATH with the marker on both sides`() {
            val cmd = ShellPathResolver.buildShellCommand("MARK")
            // command printenv bypasses aliases/functions; markers sandwich the value.
            assertTrue(cmd.contains("printf 'MARK'"), "command was: $cmd")
            assertTrue(cmd.contains("command printenv PATH"), "command was: $cmd")
            // marker must appear exactly twice so the extractor can find a pair
            assertEquals(2, Regex("MARK").findAll(cmd).count())
        }
    }

    @Nested
    inner class MergePaths {
        @Test
        fun `should put the shell PATH entries first then the base entries`() {
            val result = ShellPathResolver.mergePaths("/nvm/bin:/usr/bin", "/usr/bin:/sbin", ":")
            assertEquals("/nvm/bin:/usr/bin:/sbin", result)
        }

        @Test
        fun `should de-duplicate while preserving first-seen order`() {
            val result = ShellPathResolver.mergePaths("/a:/b", "/b:/c:/a", ":")
            assertEquals("/a:/b:/c", result)
        }

        @Test
        fun `should drop empty segments`() {
            val result = ShellPathResolver.mergePaths("/a::/b", ":/c:", ":")
            assertEquals("/a:/b:/c", result)
        }

        @Test
        fun `should return base when shell PATH is null`() {
            assertEquals("/usr/bin:/sbin", ShellPathResolver.mergePaths(null, "/usr/bin:/sbin", ":"))
        }

        @Test
        fun `should return shell PATH when base is empty`() {
            assertEquals("/nvm/bin", ShellPathResolver.mergePaths("/nvm/bin", "", ":"))
        }

        @Test
        fun `should honour a custom separator`() {
            val result = ShellPathResolver.mergePaths("C:\\node", "C:\\sys;C:\\node", ";")
            assertEquals("C:\\node;C:\\sys", result)
        }
    }
}
