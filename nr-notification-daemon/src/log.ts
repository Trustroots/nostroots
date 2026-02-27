import * as logPackage from "@std/log";
import { serializeArg } from "@trustroots/nr-common";

logPackage.setup({
  handlers: {
    console: new logPackage.ConsoleHandler("DEBUG", {
      formatter: function (record) {
        const argsString = record.args.length > 0
          ? " " + record.args.map(serializeArg).join(" ")
          : "";
        return `${record.datetime.toISOString()} [${record.levelName}] ${record.msg}${argsString}`;
      },
      useColors: false,
    }),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

export const log = logPackage.getLogger();
