import { publishGatheringPromiseAction } from "@/redux/actions/publishGathering.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { getLocalTimezoneAbbr } from "@/utils/event-gathering.utils";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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

type PickerMode = "date" | "time";
type ActivePicker = "startDate" | "startTime" | "endDate" | "endTime" | null;

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
    () => new Date(Date.now() + 60 * 60 * 1000), // default: 1 hour from now
  );
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEnd, setHasEnd] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [isSending, setIsSending] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setStartDate(new Date(Date.now() + 60 * 60 * 1000));
    setEndDate(null);
    setHasEnd(false);
    setActivePicker(null);
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

  const handleDateChange = useCallback(
    (picker: ActivePicker) =>
      (_evt: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === "android") {
          setActivePicker(null);
        }
        if (!selectedDate) return;

        if (picker === "startDate" || picker === "startTime") {
          setStartDate(selectedDate);
        } else if (picker === "endDate" || picker === "endTime") {
          setEndDate(selectedDate);
        }
      },
    [],
  );

  const getPickerMode = (picker: ActivePicker): PickerMode => {
    if (picker === "startTime" || picker === "endTime") return "time";
    return "date";
  };

  const getPickerValue = (picker: ActivePicker): Date => {
    if (picker === "endDate" || picker === "endTime") {
      return endDate ?? new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }
    return startDate;
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-background"
        style={{ paddingTop: Platform.OS === "android" ? top : 0 }}
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
          contentContainerStyle={{ padding: 20, gap: 20 }}
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
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Start *{tzAbbr ? ` (${tzAbbr})` : ""}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() =>
                  setActivePicker(
                    activePicker === "startDate" ? null : "startDate",
                  )
                }
                className={`flex-1 px-4 py-3 rounded-xl border ${
                  activePicker === "startDate"
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-muted/20"
                }`}
              >
                <Text className="text-sm text-foreground">
                  {formatDate(startDate)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setActivePicker(
                    activePicker === "startTime" ? null : "startTime",
                  )
                }
                className={`px-4 py-3 rounded-xl border ${
                  activePicker === "startTime"
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-muted/20"
                }`}
              >
                <Text className="text-sm text-foreground">
                  {formatTime(startDate)}
                </Text>
              </Pressable>
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
                setActivePicker(null);
              }}
              className="flex-row items-center gap-2 mb-1"
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
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() =>
                    setActivePicker(
                      activePicker === "endDate" ? null : "endDate",
                    )
                  }
                  className={`flex-1 px-4 py-3 rounded-xl border ${
                    activePicker === "endDate"
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-muted/20"
                  }`}
                >
                  <Text className="text-sm text-foreground">
                    {formatDate(endDate)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setActivePicker(
                      activePicker === "endTime" ? null : "endTime",
                    )
                  }
                  className={`px-4 py-3 rounded-xl border ${
                    activePicker === "endTime"
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-muted/20"
                  }`}
                >
                  <Text className="text-sm text-foreground">
                    {formatTime(endDate)}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Native date/time picker */}
          {activePicker !== null && (
            <DateTimePicker
              value={getPickerValue(activePicker)}
              mode={getPickerMode(activePicker)}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={handleDateChange(activePicker)}
            />
          )}

          {/* Submit */}
          <Button
            onPress={handleSubmit}
            className="rounded-xl py-3"
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
