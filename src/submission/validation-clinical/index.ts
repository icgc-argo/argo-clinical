import * as donor from "./donor";
import * as sample from "./sample";
import * as specimen from "./specimen";

// this done because typescript doesn't allow mapping with string index signature for default export
export const submissionValidator: { [k: string]: any } = {
  donor,
  sample,
  specimen
};
