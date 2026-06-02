import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { settingsActions } from "@/redux/slices/settings.slice";
import type { AppDispatch } from "@/redux/store";
import { createKind10390EventTemplate } from "@trustroots/nr-common";

const LOG_PREFIX = "[nr-app:onboarding:profile]";

export async function publishTrustrootsProfile(
  username: string,
  dispatch: AppDispatch,
) {
  console.log(`${LOG_PREFIX} publish Trustroots profile start`, { username });
  const eventTemplate = createKind10390EventTemplate(username);
  await dispatch(publishEventTemplatePromiseAction.request({ eventTemplate }));
  console.log(`${LOG_PREFIX} publish Trustroots profile success`, { username });
}

export async function finalizeTrustrootsProfilePublish(
  username: string,
  dispatch: AppDispatch,
) {
  console.log(`${LOG_PREFIX} finalize profile publish start`, { username });
  dispatch(settingsActions.setPendingTrustrootsProfileUsername(username));

  await publishTrustrootsProfile(username, dispatch);

  dispatch(settingsActions.setUsername(username));
  dispatch(settingsActions.clearPendingTrustrootsUsername());
  dispatch(settingsActions.clearPendingTrustrootsProfileUsername());
  console.log(`${LOG_PREFIX} finalize profile publish success`, { username });
}
