import { logPackage } from "../deps.ts";

logPackage.setup({
  handlers: {
    console: new logPackage.ConsoleHandler("DEBUG", {
      formatter: function (record) {
        const argsString =
          record.args.length > 0
            ? `\n${Deno.inspect(record.args, { colors: true })}`
            : "";
        return `${record.datetime.toISOString()} [${record.levelName}] ${
          record.msg
        } ${argsString}`;
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
