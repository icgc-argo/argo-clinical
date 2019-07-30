/* Don't use the double forward slash for commenting */
/* Important to return the 'result' object in the end of the validate function */
/* The script recives two variables: $row and $field
  row contains the values in the current row under validation, while the 
  field holds the value of the field associated with this script.
*/
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
