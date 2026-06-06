import { publishGatheringPromiseAction } from "@/redux/actions/publishGathering.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { getLocalTimezoneAbbr } from "@/utils/event-gathering.utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

interface EventComposerModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EventComposerModal({
  visible,
  onClose,
}: EventComposerModalProps) {
  const dispatch = useAppDispatch();
  const selectedPlusCode = useAppSelector(mapSelectors.selectSelectedPlusCode);
  const { top } = useSafeAreaInsets();
  const tzAbbr = getLocalTimezoneAbbr();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>(
    () => new Date(Date.now() + 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEnd, setHasEnd] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setStartDate(new Date(Date.now() + 60 * 60 * 1000));
    setEndDate(null);
    setHasEnd(false);
    setIsSending(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlusCode || selectedPlusCode.length === 0) {
      Toast.show("No location selected", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      Toast.show("Title must be at least 2 characters", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      return;
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp =
      hasEnd && endDate ? Math.floor(endDate.getTime() / 1000) : undefined;

    if (endTimestamp !== undefined && endTimestamp <= startTimestamp) {
      Toast.show("End time must be after start time", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      return;
    }

    setIsSending(true);

    try {
      await dispatch(
        publishGatheringPromiseAction({
          title: trimmedTitle,
          description: description.trim(),
          plusCode: selectedPlusCode,
          startTimestamp,
          endTimestamp,
        }),
      );

      Toast.show("Event created!", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.TOP,
      });
      handleClose();
    } catch {
      Toast.show("Failed to create event. Try again.", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      setIsSending(false);
    }
  }, [
    selectedPlusCode,
    title,
    description,
    startDate,
    endDate,
    hasEnd,
    dispatch,
    handleClose,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-background"
        style={{ paddingTop: top }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border/15">
          <View className="flex-row items-center gap-2">
            <Icon as={Calendar} size={20} className="text-primary" />
            <Text className="text-lg font-bold text-foreground">
              Create Event
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="w-8 h-8 rounded-full bg-muted/50 items-center justify-center"
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Icon as={X} size={16} className="text-foreground" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Location (read-only) */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Location
            </Text>
            <Text className="text-sm text-foreground">
              {selectedPlusCode || "No location selected"}
            </Text>
          </View>

          {/* Title */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Title *
            </Text>
            <TextInput
              className="px-4 py-3 bg-muted/20 rounded-xl text-foreground text-[15px]"
              placeholder="e.g. Community potluck dinner"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Description
            </Text>
            <TextInput
              className="px-4 py-3 bg-muted/20 rounded-xl text-foreground text-[15px]"
              placeholder="What's this gathering about?"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          {/* Start date/time */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Start *{tzAbbr ? ` (${tzAbbr})` : ""}
            </Text>
            <View className="flex-row items-center gap-3">
              <DateTimePicker
                value={startDate}
                mode="date"
                display="compact"
                minimumDate={new Date()}
                onChange={(_e, date) => date && setStartDate(date)}
              />
              <DateTimePicker
                value={startDate}
                mode="time"
                display="compact"
                onChange={(_e, date) => date && setStartDate(date)}
              />
            </View>
          </View>

          {/* End date/time (optional) */}
          <View>
            <Pressable
              onPress={() => {
                const newHasEnd = !hasEnd;
                setHasEnd(newHasEnd);
                if (newHasEnd && !endDate) {
                  setEndDate(
                    new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
                  );
                }
              }}
              className="flex-row items-center gap-2 mb-2"
            >
              <View
                className={`w-4 h-4 rounded border items-center justify-center ${
                  hasEnd ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {hasEnd && (
                  <Text className="text-[10px] text-primary-foreground font-bold">
                    ✓
                  </Text>
                )}
              </View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                End time{tzAbbr ? ` (${tzAbbr})` : ""}
              </Text>
            </Pressable>

            {hasEnd && endDate && (
              <View className="flex-row items-center gap-3">
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="compact"
                  minimumDate={startDate}
                  onChange={(_e, date) => date && setEndDate(date)}
                />
                <DateTimePicker
                  value={endDate}
                  mode="time"
                  display="compact"
                  onChange={(_e, date) => date && setEndDate(date)}
                />
              </View>
            )}
          </View>

          {/* Submit */}
          <Button
            onPress={handleSubmit}
            className="rounded-xl mt-4"
            size="lg"
            disabled={isSending || title.trim().length < 2}
          >
            <Text className="text-primary-foreground font-semibold text-base">
              {isSending ? "Creating..." : "Create Event"}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
