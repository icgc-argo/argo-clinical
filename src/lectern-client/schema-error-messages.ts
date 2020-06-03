/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
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

const INVALID_VALUE_ERROR_MESSAGE = 'The value is not permissible for this field.';
const ERROR_MESSAGES: { [key: string]: (errorData: any) => string } = {
  INVALID_FIELD_VALUE_TYPE: () => INVALID_VALUE_ERROR_MESSAGE,
  INVALID_BY_REGEX: errData => getRegexErrorMsg(errData.info),
  INVALID_BY_RANGE: () => 'Value is out of permissible range',
  INVALID_BY_SCRIPT: error => error.info.message,
  INVALID_ENUM_VALUE: () => INVALID_VALUE_ERROR_MESSAGE,
  MISSING_REQUIRED_FIELD: errorData => `${errorData.fieldName} is a required field.`,
};

// Returns the formatted message for the given error key, taking any required properties from the info object
// Default value is the errorType itself (so we can identify errorTypes that we are missing messages for and the user could look up the error meaning in our docs)
const schemaErrorMessage = (errorType: string, errorData: any = {}): string => {
  return errorType && Object.keys(ERROR_MESSAGES).includes(errorType)
    ? ERROR_MESSAGES[errorType](errorData)
    : errorType;
};

function getRegexErrorMsg(info: any) {
  let msg = `The value is not a permissible for this field, it must meet the regular expression: "${info.regex}".`;
  if (info.examples) {
    msg = msg + ` Examples: ${info.examples}`;
  }
  return msg;
}

export default schemaErrorMessage;
