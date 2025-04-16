import { logger, consoleTransport } from "react-native-logs";

export const rootLogger = logger.createLogger({
  transport: consoleTransport,
});
