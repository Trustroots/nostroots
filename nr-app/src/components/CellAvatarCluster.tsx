import { useAppSelector } from "@/redux/hooks";
import {
  CellAuthorInfo,
  selectCellAuthorsFactory,
} from "@/redux/selectors/cellAuthors.selector";
import { selectProfileByPubkey } from "@/redux/slices/profiles.slice";
import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const AVATAR_SIZE = 28;
const BADGE_SIZE = 14;
const OVERLAP = 8;

function AvatarWithBadge({ author }: { author: CellAuthorInfo }) {
  const profile = useAppSelector((state) =>
    selectProfileByPubkey(state, author.pubkey),
  );
  const displayLetter = (profile?.name || "?")[0].toUpperCase();

  return (
    <View style={styles.avatarWrapper}>
      {profile?.picture ? (
        <Image source={{ uri: profile.picture }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{displayLetter}</Text>
        </View>
      )}
      {author.intentEmoji ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{author.intentEmoji}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function CellAvatarCluster({ plusCode }: { plusCode: string }) {
  const selectCellAuthors = useMemo(
    () => selectCellAuthorsFactory(plusCode),
    [plusCode],
  );
  const { authors, totalUniqueAuthors } = useAppSelector(selectCellAuthors);

  if (authors.length === 0) return null;

  const overflow = totalUniqueAuthors - authors.length;

  return (
    <View style={styles.container}>
      {authors.map((author, index) => (
        <View
          key={author.pubkey}
          style={[
            styles.avatarSlot,
            { marginLeft: index === 0 ? 0 : -OVERLAP },
            { zIndex: authors.length - index },
          ]}
        >
          <AvatarWithBadge author={author} />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.overflowPill, { marginLeft: -OVERLAP }]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function CellCountBadge({ plusCode }: { plusCode: string }) {
  const selectCellAuthors = useMemo(
    () => selectCellAuthorsFactory(plusCode),
    [plusCode],
  );
  const { totalUniqueAuthors } = useAppSelector(selectCellAuthors);

  if (totalUniqueAuthors === 0) return null;

  return (
    <View style={styles.countBadge}>
      <Text style={styles.countText}>{totalUniqueAuthors}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarSlot: {
    // Needed for z-index to work on Android
    elevation: 1,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "white",
  },
  avatarFallback: {
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
  },
  badgeText: {
    fontSize: 8,
  },
  overflowPill: {
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "white",
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  overflowText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: "#374151",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "white",
  },
  countText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
});
