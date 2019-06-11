/*
 * Copyright (c) 2019. Ontario Institute for Cancer Research
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

package org.icgc_argo.clinical.model.entity;

import lombok.Data;
import lombok.experimental.Accessors;
import org.icgc_argo.clinical.model.constants.Tables;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.IdClass;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.util.UUID;

@Data
@Entity
@Accessors(chain = true)
@Table(name = Tables.DONOR)
@IdClass(DonorPK.class)
public class DonorEntity implements Serializable {

  private static final long serialVersionUID = 1L;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private int entityId;

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
//  @GenericGenerator(name = "program_uuid", strategy = "org.hibernate.id.UUIDGenerator")
//  @GeneratedValue(generator = "program_uuid")
  private UUID id;

  @NotNull
  private String submitterId;

  @NotNull
  private UUID programId;

}
