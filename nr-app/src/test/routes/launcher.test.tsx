import { fireEvent, screen } from "@testing-library/react-native";

import { ROUTES } from "@/constants/routes";
import { renderWithProviders } from "@/test/render";
import LauncherScreen from "../../../app/launcher";

describe("LauncherScreen", () => {
  it("opens the map from the Nostroots entry", () => {
    const { router } = renderWithProviders(<LauncherScreen />);

    fireEvent.press(screen.getByText("Nostroots"));

    expect(router.replace).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("shows upcoming apps as a disabled entry", () => {
    const { router } = renderWithProviders(<LauncherScreen />);

    const comingSoon = screen.getByLabelText("More coming soon");
    fireEvent.press(comingSoon);

    expect(comingSoon.props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
