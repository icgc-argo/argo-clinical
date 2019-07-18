/* important to return the result object here here */
function validate() {
  var result = { valid: true, message: "ok" };

  /* custom logic start */
  var person = $row;
  var postalCode = $field;

  if (person.country === "US") {
    var valid = /^[0-9]{5}(?:-[0-9]{4})?$/.test(postalCode);
    if (!valid) {
      result.valid = false;
      result.message = "invalid postal code for US";
    }
  } else if (person.country === "CANADA") {
    var valid = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode);
    if (!valid) {
      result.valid = false;
      result.message = "invalid postal code for CANADA";
    }
  }
  /* custom logic end */

  return result;
}

validate();
