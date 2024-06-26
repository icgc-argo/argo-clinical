/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import { EntityAlias } from '../common-model/entities';
import { CompletionState } from './api/types';
import { Values } from '../utils/objectTypes';

// Types Specific to Clinical Service and Related Tasks

// Base type for Clinical Data Queries
export type ClinicalDonorEntityQuery = {
	donorIds: number[];
	submitterDonorIds: string[];
	entityTypes: EntityAlias[];
};

// Types related to sorting, filtering, pagination, etc
export type PaginationQuery = {
	page: number;
	pageSize?: number;
	sort: string;
};

export type ClinicalDataPaginatedQuery = ClinicalDonorEntityQuery & PaginationQuery;

export type ClinicalDataQuery = ClinicalDataPaginatedQuery & {
	completionState?: {};
};

export const ClinicalDataSortTypes = {
	defaultDonor: 'defaultDonor',
	invalidEntity: 'invalidEntity',
	columnSort: 'columnSort',
};

export type ClinicalDataSortType = Values<typeof ClinicalDataSortTypes>;

// GQL Query Arguments
// Submitted Data Table, SearchBar, Sidebar, etc.
export type ClinicalDataApiFilters = ClinicalDataPaginatedQuery & {
	completionState?: CompletionState;
};

export type ClinicalDataVariables = {
	programShortName: string;
	filters: ClinicalDataApiFilters;
};
