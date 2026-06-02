import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { settingsActions } from "@/redux/slices/settings.slice";
import type { AppDispatch } from "@/redux/store";
import { createKind10390EventTemplate } from "@trustroots/nr-common";

export async function publishTrustrootsProfile(
  username: string,
  dispatch: AppDispatch,
) {
  const eventTemplate = createKind10390EventTemplate(username);
  await dispatch(publishEventTemplatePromiseAction.request({ eventTemplate }));
}

export async function finalizeTrustrootsProfilePublish(
  username: string,
  dispatch: AppDispatch,
) {
  dispatch(settingsActions.setPendingTrustrootsProfileUsername(username));

  await publishTrustrootsProfile(username, dispatch);

  dispatch(settingsActions.setUsername(username));
  dispatch(settingsActions.clearPendingTrustrootsUsername());
  dispatch(settingsActions.clearPendingTrustrootsProfileUsername());
}
