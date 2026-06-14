import { fireEvent } from "@testing-library/react-native";

import ListScreen from "./list";
import { renderWithProviders } from "@/test/test-utils";

describe("ListScreen", () => {
  it("switches between feed, signals, and events empty states", () => {
    const { getByText } = renderWithProviders(<ListScreen />);

    expect(getByText("Discover")).toBeTruthy();
    expect(getByText("No notes yet")).toBeTruthy();

    fireEvent.press(getByText("Signals"));
    expect(getByText("No active signals")).toBeTruthy();

    fireEvent.press(getByText("Events"));
    expect(getByText("No events yet")).toBeTruthy();

    fireEvent.press(getByText("Feed"));
    expect(getByText("No notes yet")).toBeTruthy();
  });
});
