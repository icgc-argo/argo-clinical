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

load data local infile 'RXNATOMARCHIVE.RRF' into table RXNATOMARCHIVE fields terminated by '|'
-- ESCAPED BY 'ä' for some reason this caused an error for a small subset of data
lines terminated by '\n'
(@rxaui,@aui,@str,@archive_timestamp,@created_timestamp,@updated_timestamp,@code,@is_brand,@lat,@last_released,@saui,@vsab,@rxcui,@sab,@tty,@merged_to_rxcui)
SET rxaui =@rxaui,
    aui =@aui,
    str =@str,
    archive_timestamp =@archive_timestamp,
    created_timestamp =@created_timestamp,
    updated_timestamp =@updated_timestamp,
    code =@code,
    is_brand =@is_brand,
    lat =@lat,
    last_released =@last_released,
    saui =@saui,
    vsab =@vsab,
    rxcui =@rxcui,
    sab =@sab,
    tty =@tty,
    merged_to_rxcui =@merged_to_rxcui;


load data local infile 'RXNCONSO.RRF' into table RXNCONSO fields terminated by '|' 
lines terminated by '\n'
(@rxcui,@lat,@ts,@lui,@stt,@sui,@ispref,@rxaui,@saui,@scui,@sdui,@sab,@tty,@code,@str,@srl,@suppress,@cvf)
SET rxcui =@rxcui,
    lat =@lat,
    ts =@ts,
    lui =@lui,
    stt =@stt,
    sui =@sui,
    ispref =@ispref,
    rxaui =@rxaui,
    saui =@saui,
    scui =@scui,
    sdui =@sdui,
    sab =@sab,
    tty =@tty,
    code =@code,
    str =@str,
    srl =@srl,
    suppress=@suppress,
    cvf=@cvf;

load data local infile 'RXNCUICHANGES.RRF' into table RXNCUICHANGES fields terminated by '|' 
lines terminated by '\n'
(@rxaui,@code,@sab,@tty,@str,@old_rxcui,@new_rxcui)
SET rxaui=@rxaui,
    code =@code,
    sab =@sab,
    tty =@tty,
    str =@str,
    old_rxcui =@old_rxcui,
    new_rxcui =@new_rxcui ;