import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { settingsActions } from "@/redux/slices/settings.slice";
import { createKind10390EventTemplate } from "@trustroots/nr-common";
import {
  finalizeTrustrootsProfilePublish,
  publishTrustrootsProfile,
} from "./trustrootsProfile.service";

describe("trustrootsProfile.service", () => {
  it("publishes a Trustroots profile event template", async () => {
    const dispatch = jest.fn(async () => undefined);
    const eventTemplate = createKind10390EventTemplate("alice");

    await publishTrustrootsProfile("alice", dispatch);

    expect(dispatch).toHaveBeenCalledWith(
      publishEventTemplatePromiseAction.request({ eventTemplate }),
    );
  });

  it("tracks pending profile publish while finalizing", async () => {
    const dispatch = jest.fn(async () => undefined);

    await finalizeTrustrootsProfilePublish("alice", dispatch);

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      settingsActions.setPendingTrustrootsProfileUsername("alice"),
    );
    expect(dispatch).toHaveBeenCalledWith(settingsActions.setUsername("alice"));
    expect(dispatch).toHaveBeenCalledWith(
      settingsActions.clearPendingTrustrootsUsername(),
    );
    expect(dispatch).toHaveBeenCalledWith(
      settingsActions.clearPendingTrustrootsProfileUsername(),
    );
  });

  it("leaves pending profile username set when publishing fails", async () => {
    const error = new Error("publish failed");
    const dispatch = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);

    await expect(
      finalizeTrustrootsProfilePublish("alice", dispatch),
    ).rejects.toBe(error);

    expect(dispatch).toHaveBeenCalledWith(
      settingsActions.setPendingTrustrootsProfileUsername("alice"),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      settingsActions.clearPendingTrustrootsProfileUsername(),
    );
  });
});
