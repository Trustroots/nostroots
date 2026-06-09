import { render } from "@testing-library/react-native";
import { Redirect } from "expo-router";

import Nip7BrowserRoute from "./browser";
import { useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;

function fakeState(areTestFeaturesEnabled: boolean) {
  return {
    settings: {
      areTestFeaturesEnabled,
    },
  };
}

describe("Nip7BrowserRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects away when Developer Mode is off", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false)),
    );
    render(<Nip7BrowserRoute />);

    expect(Redirect).toHaveBeenCalledWith({ href: "/(main)/(map)" }, undefined);
  });
});
