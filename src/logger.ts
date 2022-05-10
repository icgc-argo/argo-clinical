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

import winston from 'winston';
const { createLogger, format, transports } = winston;
const { combine, timestamp, label, prettyPrint, json, align, simple } = format;

// read the log level from the env directly since this is a very high priority value.
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
console.log('log level configured: ', LOG_LEVEL);

// Logger configuration
const logConfiguration = {
  level: LOG_LEVEL,
  format: combine(json(), simple(), timestamp()),
  transports: [new winston.transports.Console()],
};

export interface Logger {
  error(msg: string, err: Error | unknown): void;
  info(msg: string): void;
  debug(msg: string): void;
  profile(s: string): void;
}

const winstonLogger = winston.createLogger(logConfiguration);
if (process.env.LOG_LEVEL == 'debug') {
  console.log('logger configured: ', winstonLogger);
}
export const loggerFor = (fileName: string): Logger => {
  if (process.env.LOG_LEVEL == 'debug') {
    console.debug('creating logger for', fileName);
  }
  const source = fileName.substring(fileName.indexOf('argo-clinical'));
  return {
    error: (msg: string, err: Error): void => {
      winstonLogger.error(msg, err, { source });
    },
    debug: (msg: string): void => {
      winstonLogger.debug(msg, { source });
    },
    info: (msg: string): void => {
      winstonLogger.info(msg, { source });
    },
    profile: (id: string): void => {
      winstonLogger.profile(id);
    },
  };
};
