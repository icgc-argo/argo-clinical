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

package org.icgc_argo.clinical;

import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.icgc_argo.clinical.model.entity.DonorEntity;
import org.icgc_argo.clinical.repository.DonorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.UUID;

@Slf4j
@SpringBootTest
@SpringJUnitConfig
@ActiveProfiles("test")
public class DonorDBTest {

  @Autowired private DonorRepository repository;

  @Test
  public void testDonorCreate() {
    val programId = UUID.randomUUID();
    val donor1 = new DonorEntity().setProgramId(programId).setSubmitterId("D_SUB_1");
    val donor2 = new DonorEntity().setProgramId(programId).setSubmitterId("D_SUB_2");
    repository.save(donor1);
    repository.save(donor2);

//    val donorActual1 = repository.findById(donor1.getId());
//    val donorActual2 = repository.findById(donor2.getId());
    log.info("sdfsdf");
  }
}
