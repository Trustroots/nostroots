import { z } from "../deps.js";
/**
 * A kind 10395 event is an event where the user specifies what nostr events
 * they want to receive a push notification about. They do that by specifying a
 * set of nostr filters, and by providing their apple / google push token. This
 * takes the form of a NIP04 encrypted event which is encrypted for the
 * notification server's private key.
 */
export declare const kind10395SubscriptionFilterSchema: z.ZodObject<{
    filter: z.ZodObject<{
        ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        kinds: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        authors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        since: z.ZodOptional<z.ZodNumber>;
        until: z.ZodOptional<z.ZodNumber>;
        limit: z.ZodOptional<z.ZodNumber>;
        search: z.ZodOptional<z.ZodString>;
        "#a": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#b": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#c": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#d": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#e": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#f": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#g": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#h": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#i": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#j": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#k": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#l": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#m": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#n": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#o": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#p": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#q": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#r": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#s": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#t": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#u": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#v": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#w": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#x": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#y": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#z": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#A": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#B": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#C": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#D": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#E": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#F": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#G": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#H": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#I": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#J": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#K": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#L": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#M": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#N": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#O": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#P": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#Q": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#R": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#S": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#T": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#U": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#V": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#W": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#X": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#Y": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        "#Z": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        ids?: string[] | undefined;
        kinds?: number[] | undefined;
        authors?: string[] | undefined;
        since?: number | undefined;
        until?: number | undefined;
        limit?: number | undefined;
        search?: string | undefined;
        "#a"?: string[] | undefined;
        "#b"?: string[] | undefined;
        "#c"?: string[] | undefined;
        "#d"?: string[] | undefined;
        "#e"?: string[] | undefined;
        "#f"?: string[] | undefined;
        "#g"?: string[] | undefined;
        "#h"?: string[] | undefined;
        "#i"?: string[] | undefined;
        "#j"?: string[] | undefined;
        "#k"?: string[] | undefined;
        "#l"?: string[] | undefined;
        "#m"?: string[] | undefined;
        "#n"?: string[] | undefined;
        "#o"?: string[] | undefined;
        "#p"?: string[] | undefined;
        "#q"?: string[] | undefined;
        "#r"?: string[] | undefined;
        "#s"?: string[] | undefined;
        "#t"?: string[] | undefined;
        "#u"?: string[] | undefined;
        "#v"?: string[] | undefined;
        "#w"?: string[] | undefined;
        "#x"?: string[] | undefined;
        "#y"?: string[] | undefined;
        "#z"?: string[] | undefined;
        "#A"?: string[] | undefined;
        "#B"?: string[] | undefined;
        "#C"?: string[] | undefined;
        "#D"?: string[] | undefined;
        "#E"?: string[] | undefined;
        "#F"?: string[] | undefined;
        "#G"?: string[] | undefined;
        "#H"?: string[] | undefined;
        "#I"?: string[] | undefined;
        "#J"?: string[] | undefined;
        "#K"?: string[] | undefined;
        "#L"?: string[] | undefined;
        "#M"?: string[] | undefined;
        "#N"?: string[] | undefined;
        "#O"?: string[] | undefined;
        "#P"?: string[] | undefined;
        "#Q"?: string[] | undefined;
        "#R"?: string[] | undefined;
        "#S"?: string[] | undefined;
        "#T"?: string[] | undefined;
        "#U"?: string[] | undefined;
        "#V"?: string[] | undefined;
        "#W"?: string[] | undefined;
        "#X"?: string[] | undefined;
        "#Y"?: string[] | undefined;
        "#Z"?: string[] | undefined;
    }, {
        ids?: string[] | undefined;
        kinds?: number[] | undefined;
        authors?: string[] | undefined;
        since?: number | undefined;
        until?: number | undefined;
        limit?: number | undefined;
        search?: string | undefined;
        "#a"?: string[] | undefined;
        "#b"?: string[] | undefined;
        "#c"?: string[] | undefined;
        "#d"?: string[] | undefined;
        "#e"?: string[] | undefined;
        "#f"?: string[] | undefined;
        "#g"?: string[] | undefined;
        "#h"?: string[] | undefined;
        "#i"?: string[] | undefined;
        "#j"?: string[] | undefined;
        "#k"?: string[] | undefined;
        "#l"?: string[] | undefined;
        "#m"?: string[] | undefined;
        "#n"?: string[] | undefined;
        "#o"?: string[] | undefined;
        "#p"?: string[] | undefined;
        "#q"?: string[] | undefined;
        "#r"?: string[] | undefined;
        "#s"?: string[] | undefined;
        "#t"?: string[] | undefined;
        "#u"?: string[] | undefined;
        "#v"?: string[] | undefined;
        "#w"?: string[] | undefined;
        "#x"?: string[] | undefined;
        "#y"?: string[] | undefined;
        "#z"?: string[] | undefined;
        "#A"?: string[] | undefined;
        "#B"?: string[] | undefined;
        "#C"?: string[] | undefined;
        "#D"?: string[] | undefined;
        "#E"?: string[] | undefined;
        "#F"?: string[] | undefined;
        "#G"?: string[] | undefined;
        "#H"?: string[] | undefined;
        "#I"?: string[] | undefined;
        "#J"?: string[] | undefined;
        "#K"?: string[] | undefined;
        "#L"?: string[] | undefined;
        "#M"?: string[] | undefined;
        "#N"?: string[] | undefined;
        "#O"?: string[] | undefined;
        "#P"?: string[] | undefined;
        "#Q"?: string[] | undefined;
        "#R"?: string[] | undefined;
        "#S"?: string[] | undefined;
        "#T"?: string[] | undefined;
        "#U"?: string[] | undefined;
        "#V"?: string[] | undefined;
        "#W"?: string[] | undefined;
        "#X"?: string[] | undefined;
        "#Y"?: string[] | undefined;
        "#Z"?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    filter: {
        ids?: string[] | undefined;
        kinds?: number[] | undefined;
        authors?: string[] | undefined;
        since?: number | undefined;
        until?: number | undefined;
        limit?: number | undefined;
        search?: string | undefined;
        "#a"?: string[] | undefined;
        "#b"?: string[] | undefined;
        "#c"?: string[] | undefined;
        "#d"?: string[] | undefined;
        "#e"?: string[] | undefined;
        "#f"?: string[] | undefined;
        "#g"?: string[] | undefined;
        "#h"?: string[] | undefined;
        "#i"?: string[] | undefined;
        "#j"?: string[] | undefined;
        "#k"?: string[] | undefined;
        "#l"?: string[] | undefined;
        "#m"?: string[] | undefined;
        "#n"?: string[] | undefined;
        "#o"?: string[] | undefined;
        "#p"?: string[] | undefined;
        "#q"?: string[] | undefined;
        "#r"?: string[] | undefined;
        "#s"?: string[] | undefined;
        "#t"?: string[] | undefined;
        "#u"?: string[] | undefined;
        "#v"?: string[] | undefined;
        "#w"?: string[] | undefined;
        "#x"?: string[] | undefined;
        "#y"?: string[] | undefined;
        "#z"?: string[] | undefined;
        "#A"?: string[] | undefined;
        "#B"?: string[] | undefined;
        "#C"?: string[] | undefined;
        "#D"?: string[] | undefined;
        "#E"?: string[] | undefined;
        "#F"?: string[] | undefined;
        "#G"?: string[] | undefined;
        "#H"?: string[] | undefined;
        "#I"?: string[] | undefined;
        "#J"?: string[] | undefined;
        "#K"?: string[] | undefined;
        "#L"?: string[] | undefined;
        "#M"?: string[] | undefined;
        "#N"?: string[] | undefined;
        "#O"?: string[] | undefined;
        "#P"?: string[] | undefined;
        "#Q"?: string[] | undefined;
        "#R"?: string[] | undefined;
        "#S"?: string[] | undefined;
        "#T"?: string[] | undefined;
        "#U"?: string[] | undefined;
        "#V"?: string[] | undefined;
        "#W"?: string[] | undefined;
        "#X"?: string[] | undefined;
        "#Y"?: string[] | undefined;
        "#Z"?: string[] | undefined;
    };
}, {
    filter: {
        ids?: string[] | undefined;
        kinds?: number[] | undefined;
        authors?: string[] | undefined;
        since?: number | undefined;
        until?: number | undefined;
        limit?: number | undefined;
        search?: string | undefined;
        "#a"?: string[] | undefined;
        "#b"?: string[] | undefined;
        "#c"?: string[] | undefined;
        "#d"?: string[] | undefined;
        "#e"?: string[] | undefined;
        "#f"?: string[] | undefined;
        "#g"?: string[] | undefined;
        "#h"?: string[] | undefined;
        "#i"?: string[] | undefined;
        "#j"?: string[] | undefined;
        "#k"?: string[] | undefined;
        "#l"?: string[] | undefined;
        "#m"?: string[] | undefined;
        "#n"?: string[] | undefined;
        "#o"?: string[] | undefined;
        "#p"?: string[] | undefined;
        "#q"?: string[] | undefined;
        "#r"?: string[] | undefined;
        "#s"?: string[] | undefined;
        "#t"?: string[] | undefined;
        "#u"?: string[] | undefined;
        "#v"?: string[] | undefined;
        "#w"?: string[] | undefined;
        "#x"?: string[] | undefined;
        "#y"?: string[] | undefined;
        "#z"?: string[] | undefined;
        "#A"?: string[] | undefined;
        "#B"?: string[] | undefined;
        "#C"?: string[] | undefined;
        "#D"?: string[] | undefined;
        "#E"?: string[] | undefined;
        "#F"?: string[] | undefined;
        "#G"?: string[] | undefined;
        "#H"?: string[] | undefined;
        "#I"?: string[] | undefined;
        "#J"?: string[] | undefined;
        "#K"?: string[] | undefined;
        "#L"?: string[] | undefined;
        "#M"?: string[] | undefined;
        "#N"?: string[] | undefined;
        "#O"?: string[] | undefined;
        "#P"?: string[] | undefined;
        "#Q"?: string[] | undefined;
        "#R"?: string[] | undefined;
        "#S"?: string[] | undefined;
        "#T"?: string[] | undefined;
        "#U"?: string[] | undefined;
        "#V"?: string[] | undefined;
        "#W"?: string[] | undefined;
        "#X"?: string[] | undefined;
        "#Y"?: string[] | undefined;
        "#Z"?: string[] | undefined;
    };
}>;
export declare const kind10395ContentDecodedSchema: z.ZodObject<{
    tokens: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    filters: z.ZodObject<{
        filter: z.ZodObject<{
            ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            kinds: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
            authors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            since: z.ZodOptional<z.ZodNumber>;
            until: z.ZodOptional<z.ZodNumber>;
            limit: z.ZodOptional<z.ZodNumber>;
            search: z.ZodOptional<z.ZodString>;
            "#a": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#b": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#c": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#d": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#e": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#f": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#g": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#h": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#i": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#j": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#k": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#l": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#m": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#n": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#o": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#p": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#q": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#r": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#s": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#t": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#u": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#v": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#w": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#x": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#y": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#z": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#A": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#B": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#C": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#D": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#E": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#F": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#G": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#H": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#I": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#J": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#K": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#L": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#M": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#N": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#O": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#P": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#Q": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#R": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#S": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#T": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#U": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#V": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#W": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#X": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#Y": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            "#Z": z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        }, {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        filter: {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        };
    }, {
        filter: {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    tokens: {};
    filters: {
        filter: {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        };
    };
}, {
    tokens: {};
    filters: {
        filter: {
            ids?: string[] | undefined;
            kinds?: number[] | undefined;
            authors?: string[] | undefined;
            since?: number | undefined;
            until?: number | undefined;
            limit?: number | undefined;
            search?: string | undefined;
            "#a"?: string[] | undefined;
            "#b"?: string[] | undefined;
            "#c"?: string[] | undefined;
            "#d"?: string[] | undefined;
            "#e"?: string[] | undefined;
            "#f"?: string[] | undefined;
            "#g"?: string[] | undefined;
            "#h"?: string[] | undefined;
            "#i"?: string[] | undefined;
            "#j"?: string[] | undefined;
            "#k"?: string[] | undefined;
            "#l"?: string[] | undefined;
            "#m"?: string[] | undefined;
            "#n"?: string[] | undefined;
            "#o"?: string[] | undefined;
            "#p"?: string[] | undefined;
            "#q"?: string[] | undefined;
            "#r"?: string[] | undefined;
            "#s"?: string[] | undefined;
            "#t"?: string[] | undefined;
            "#u"?: string[] | undefined;
            "#v"?: string[] | undefined;
            "#w"?: string[] | undefined;
            "#x"?: string[] | undefined;
            "#y"?: string[] | undefined;
            "#z"?: string[] | undefined;
            "#A"?: string[] | undefined;
            "#B"?: string[] | undefined;
            "#C"?: string[] | undefined;
            "#D"?: string[] | undefined;
            "#E"?: string[] | undefined;
            "#F"?: string[] | undefined;
            "#G"?: string[] | undefined;
            "#H"?: string[] | undefined;
            "#I"?: string[] | undefined;
            "#J"?: string[] | undefined;
            "#K"?: string[] | undefined;
            "#L"?: string[] | undefined;
            "#M"?: string[] | undefined;
            "#N"?: string[] | undefined;
            "#O"?: string[] | undefined;
            "#P"?: string[] | undefined;
            "#Q"?: string[] | undefined;
            "#R"?: string[] | undefined;
            "#S"?: string[] | undefined;
            "#T"?: string[] | undefined;
            "#U"?: string[] | undefined;
            "#V"?: string[] | undefined;
            "#W"?: string[] | undefined;
            "#X"?: string[] | undefined;
            "#Y"?: string[] | undefined;
            "#Z"?: string[] | undefined;
        };
    };
}>;
export declare const kind10395EventSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, {
    kind: z.ZodLiteral<10395>;
    content: z.ZodEffects<z.ZodString, string, string>;
}>, "strict", z.ZodTypeAny, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>;
