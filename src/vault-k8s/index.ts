/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

import vault from 'node-vault';
import { promises } from 'fs';
let vaultClient: vault.Client;

async function login() {
	// if the app provided a token in the env use that
	const givenToken = process.env.VAULT_TOKEN;
	if (givenToken) {
		const options: vault.VaultOptions = {
			apiVersion: 'v1', // default
			endpoint: process.env.VAULT_URL || 'http://localhost:8200', // default
			token: givenToken,
		};
		vaultClient = vault(options);
		return;
	}

	// otherwise try and load the token from kubernetes
	const k8sToken = await promises.readFile(
		'/var/run/secrets/kubernetes.io/serviceaccount/token',
		'utf-8',
	);

	// exchange for a vault token
	const options: vault.VaultOptions = {
		apiVersion: 'v1',
		endpoint: process.env.VAULT_URL,
	};

	vaultClient = vault(options);
	const response = await vaultClient.kubernetesLogin({
		role: process.env.VAULT_ROLE,
		jwt: k8sToken,
	});

	const clientToken = response.auth.client_token as string;
	console.log(`login successful, token length: ${clientToken.length}`);
}

export async function loadSecret(key: string) {
	if (!vaultClient) {
		await login();
	}

	const result = await vaultClient.read(key);
	console.log(`loaded Secret ${key}`);
	if (result.data.data) {
		return result.data.data;
	}
	return result.data;
}
