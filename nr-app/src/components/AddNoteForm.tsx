import { publishNotePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import {
  SIGNAL_DURATIONS,
  SIGNAL_INTENTS,
  SignalDuration,
  SignalIntent,
} from "@/constants/signals";
import { getCurrentTimestamp } from "@trustroots/nr-common";
import { nanoid } from "@reduxjs/toolkit";
import { Send } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import Toast from "react-native-root-toast";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

interface OptimisticNote {
  id: string;
  content: string;
  createdAt: number;
  status: "sending" | "failed";
}

interface AddNoteFormProps {
  onSent?: () => void;
  signalMode?: boolean;
  onSignalSent?: () => void;
}

const INTENT_PLACEHOLDERS: Record<string, string> = {
  coffee: "Anyone down for coffee?",
  drinks: "Wanna get drinks with me?",
  explore: "Who wants to explore around here?",
  hosting: "I can host! Say more...",
  ride: "Looking for a ride or offering one?",
};

function getIntentPlaceholder(intent: SignalIntent | null): string {
  if (!intent) return "What are you up to?";
  return INTENT_PLACEHOLDERS[intent] ?? "What are you up to?";
}

export default function AddNoteForm({
  onSent,
  signalMode = false,
  onSignalSent,
}: AddNoteFormProps) {
  const dispatch = useAppDispatch();
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);

  const [noteContent, setNoteContent] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<SignalIntent | null>(
    null,
  );
  const [selectedDuration, setSelectedDuration] =
    useState<SignalDuration>("1-week");
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [optimisticNotes, setOptimisticNotes] = useState<OptimisticNote[]>([]);

  // When not in signal mode, intent is always null
  const effectiveIntent = signalMode ? selectedIntent : null;

  const handleSend = useCallback(async () => {
    if (
      typeof selectedPlusCode === "undefined" ||
      selectedPlusCode.length === 0
    ) {
      Toast.show("Error: No plus code selected. #Rjbe0s", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      return;
    }

    const trimmedContent = noteContent.trim();
    if (trimmedContent.length < 3) {
      Toast.show("Note must be at least 3 characters long", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      return;
    }

    let expirationTimestampSeconds: number;
    if (customDate) {
      expirationTimestampSeconds = Math.floor(customDate.getTime() / 1000);
    } else {
      const durationEntry = SIGNAL_DURATIONS.find(
        (d) => d.key === selectedDuration,
      );
      const durationSeconds = durationEntry?.seconds ?? 7 * 24 * 60 * 60;
      expirationTimestampSeconds = getCurrentTimestamp() + durationSeconds;
    }

    // Create optimistic note
    const optimisticId = nanoid();
    const optimisticNote: OptimisticNote = {
      id: optimisticId,
      content: trimmedContent,
      createdAt: getCurrentTimestamp(),
      status: "sending",
    };

    // Immediately clear input and show optimistic note
    setNoteContent("");
    setOptimisticNotes((prev) => [...prev, optimisticNote]);
    onSent?.();

    try {
      const timeout = setTimeout(() => {
        setOptimisticNotes((prev) =>
          prev.map((n) =>
            n.id === optimisticId ? { ...n, status: "failed" as const } : n,
          ),
        );
      }, 10000);

      await dispatch(
        publishNotePromiseAction(
          trimmedContent,
          selectedPlusCode,
          expirationTimestampSeconds,
          effectiveIntent ?? undefined,
        ),
      );

      clearTimeout(timeout);

      // Remove optimistic note on success (real note will appear via relay subscription)
      setOptimisticNotes((prev) => prev.filter((n) => n.id !== optimisticId));

      // Exit signal mode after successful send
      if (effectiveIntent) {
        onSignalSent?.();
      }
    } catch {
      // Mark as failed
      setOptimisticNotes((prev) =>
        prev.map((n) =>
          n.id === optimisticId ? { ...n, status: "failed" as const } : n,
        ),
      );
    }
  }, [
    selectedPlusCode,
    noteContent,
    dispatch,
    selectedDuration,
    customDate,
    effectiveIntent,
    onSent,
    onSignalSent,
  ]);

  const handleRetry = useCallback(
    async (note: OptimisticNote) => {
      setOptimisticNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, status: "sending" as const } : n,
        ),
      );

      let expirationTimestampSeconds: number;
      if (customDate) {
        expirationTimestampSeconds = Math.floor(customDate.getTime() / 1000);
      } else {
        const durationEntry = SIGNAL_DURATIONS.find(
          (d) => d.key === selectedDuration,
        );
        const durationSeconds = durationEntry?.seconds ?? 7 * 24 * 60 * 60;
        expirationTimestampSeconds = getCurrentTimestamp() + durationSeconds;
      }

      try {
        await dispatch(
          publishNotePromiseAction(
            note.content,
            selectedPlusCode,
            expirationTimestampSeconds,
            selectedIntent ?? undefined,
          ),
        );
        setOptimisticNotes((prev) => prev.filter((n) => n.id !== note.id));
      } catch {
        setOptimisticNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, status: "failed" as const } : n,
          ),
        );
      }
    },
    [dispatch, selectedDuration, customDate, selectedIntent, selectedPlusCode],
  );

  return (
    <View className="px-4 py-3 gap-2.5">
      {/* Optimistic notes */}
      {optimisticNotes.map((note) => (
        <View
          key={note.id}
          className={`px-3 py-1 ${note.status === "sending" ? "opacity-40" : ""}`}
        >
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-sm font-semibold text-primary">You</Text>
            {note.status === "sending" ? (
              <Text className="text-[11px] text-muted-foreground">
                sending...
              </Text>
            ) : (
              <Pressable onPress={() => handleRetry(note)}>
                <Text className="text-[11px] text-destructive font-semibold">
                  tap to retry
                </Text>
              </Pressable>
            )}
          </View>
          <Text className="text-[15px] leading-snug text-foreground mt-0.5">
            {note.content}
          </Text>
        </View>
      ))}

      {/* Signal mode: intent chips (emoji only) */}
      {signalMode && (
        <View className="flex-row flex-wrap gap-1.5">
          {SIGNAL_INTENTS.map((intent) => {
            const isSelected = selectedIntent === intent.key;
            return (
              <Pressable
                key={intent.key}
                onPress={() =>
                  setSelectedIntent(isSelected ? null : intent.key)
                }
                className={`rounded-full px-3 py-1.5 border ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-muted/20"
                }`}
              >
                <Text className="text-base">{intent.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Send bar: input + send button */}
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <TextInput
            className="w-full px-4 py-3 bg-muted/20 rounded-2xl text-foreground text-[15px]"
            placeholder={
              signalMode
                ? getIntentPlaceholder(selectedIntent)
                : "Share a tip or say hi..."
            }
            placeholderTextColor="#9ca3af"
            value={noteContent}
            onChangeText={setNoteContent}
            onSubmitEditing={handleSend}
            multiline={true}
            style={{ maxHeight: 100 }}
          />
        </View>
        <Button
          onPress={handleSend}
          size="icon"
          className="h-11 w-11 rounded-full"
          disabled={noteContent.trim().length < 3}
        >
          <Icon as={Send} size={18} className="text-primary-foreground" />
        </Button>
      </View>

      {/* Duration chips — always visible */}
      <View className="flex-row items-center gap-1.5">
        <Text className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">
          Expires
        </Text>
        {SIGNAL_DURATIONS.map((duration) => {
          const isSelected = !customDate && selectedDuration === duration.key;
          return (
            <Pressable
              key={duration.key}
              onPress={() => {
                setSelectedDuration(duration.key);
                setCustomDate(null);
                setShowDatePicker(false);
              }}
              className={`rounded-full px-2.5 py-1 border ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-muted/20"
              }`}
            >
              <Text
                className={`text-[11px] font-medium ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {duration.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowDatePicker(!showDatePicker)}
          className={`rounded-full px-2.5 py-1 border ${
            customDate
              ? "border-primary bg-primary/10"
              : "border-border/50 bg-muted/20"
          }`}
        >
          <Text
            className={`text-[11px] font-medium ${
              customDate ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {customDate
              ? customDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "Custom..."}
          </Text>
        </Pressable>
      </View>

      {/* Date picker for custom expiry */}
      {showDatePicker && (
        <DateTimePicker
          value={customDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
          onChange={(_event, date) => {
            if (Platform.OS === "android") {
              setShowDatePicker(false);
            }
            if (date) {
              setCustomDate(date);
            }
          }}
        />
      )}
    </View>
  );
}
