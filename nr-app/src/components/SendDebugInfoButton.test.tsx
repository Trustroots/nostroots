import { fireEvent, render } from "@testing-library/react-native";

import { SendDebugInfoButton } from "./SendDebugInfoButton";
import { ROUTES } from "@/constants/routes";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SendDebugInfoButton", () => {
  it("navigates to the feedback screen", () => {
    const { getByText } = render(<SendDebugInfoButton />);

    fireEvent.press(getByText("Send feedback"));

    expect(mockPush).toHaveBeenCalledWith(ROUTES.FEEDBACK);
  });
});
