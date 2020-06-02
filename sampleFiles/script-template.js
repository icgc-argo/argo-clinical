/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* Don't use the double forward slash for commenting */
/* Important to return the 'result' object in the end of the validate function */
/* The script recives two variables: $row and $field
  row contains the values in the current row under validation, while the 
  field holds the value of the field associated with this script.
*/
function validate() {
  var result = { valid: true, message: 'ok' };

  /* custom logic start */
  var person = $row;
  var postalCode = $field;

  if (person.country === 'US') {
    var valid = /^[0-9]{5}(?:-[0-9]{4})?$/.test(postalCode);
    if (!valid) {
      result.valid = false;
      result.message = 'invalid postal code for US';
    }
  } else if (person.country === 'CANADA') {
    var valid = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode);
    if (!valid) {
      result.valid = false;
      result.message = 'invalid postal code for CANADA';
    }
  }
  /* custom logic end */

  return result;
}

validate();
