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

package org.icgc_argo.clinical.jpa;

import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.icgc_argo.clinical.model.entity.DonorEntity;
import org.icgc_argo.clinical.repository.DonorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.Random;
import java.util.UUID;

import static java.util.stream.StreamSupport.stream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

@Slf4j
@SpringBootTest
@SpringJUnitConfig
@ActiveProfiles("test")
public class DonorJPATest {

  private static final String SUBMITTER_ID_PREFIX = "D_SUB_";
  private static final Random RANDOM = new Random();

  @Autowired private DonorRepository repository;

  private String generateUniqueSubmitterId(){
    String submitterId = null;
    do {
      submitterId = SUBMITTER_ID_PREFIX+(RANDOM.nextInt()<<16);
    } while (repository.existsBySubmitterId(submitterId));
    return submitterId;
  }

  /**
   * Create a donor using the minimal amount of data
   */
  @Test
  public void createDonor_minimal_success(){
    val programId = UUID.randomUUID();

    // Create entities
    val submitterId1 = generateUniqueSubmitterId();
    val donor1 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(submitterId1);

    val submitterId2 = generateUniqueSubmitterId();
    val donor2 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(submitterId2);

    // Check that id and simpleId fields are null
    assertThat(donor1.getId()).isNull();
    assertThat(donor1.getSimpleId()).isNull();
    assertThat(donor2.getId()).isNull();
    assertThat(donor2.getSimpleId()).isNull();

    // Commit the entities
    repository.save(donor1);
    repository.save(donor2);

    // Assert they exist and were created
    assertThat(repository.existsById(donor1.getId())).isTrue();
    assertThat(repository.existsById(donor2.getId())).isTrue();

    // Read the entities
    val result1 = repository.findById(donor1.getId()).get();
    val result2 = repository.findById(donor2.getId()).get();

    // Verify the simpleIds were automatically generated and are greater than 0
    assertThat(result1.getSimpleId()).isNotNull();
    assertThat(result1.getSimpleId()).isGreaterThan(0);
    assertThat(result2.getSimpleId()).isNotNull();
    assertThat(result2.getSimpleId()).isGreaterThan(0);
    assertThat(result1.getSubmitterId()).isEqualTo(submitterId1);
    assertThat(result2.getSubmitterId()).isEqualTo(submitterId2);

    // Verify sequential auto incrementing works by ensuring the simpleId for result2 is greater than result1's
    assertThat(result1.getSimpleId()).isLessThan(result2.getSimpleId());
  }

  @Test
  public void nonInsertableSimpleId_nonExisting_success(){
    val programId = UUID.randomUUID();

    // Find the largest simpleId
    val largestSimpleId = stream(repository.findAll().spliterator(), false)
        .map(DonorEntity::getSimpleId)
        .reduce(-1, (currMax, x) -> {
          if (currMax < x){
            return x;
          }
          return currMax;
        } );

    // Pick a simpleId to test
    val newSimpleId = largestSimpleId*2;

    // Create entities using the newSimpleId
    val donor1 = new DonorEntity()
        .setSimpleId(newSimpleId)
        .setProgramId(programId)
        .setSubmitterId(generateUniqueSubmitterId());

    val donor2 = new DonorEntity()
        .setSimpleId(newSimpleId+2)
        .setProgramId(programId)
        .setSubmitterId(generateUniqueSubmitterId());
    repository.save(donor1);
    repository.save(donor2);

    // Assert they exist and were created
    assertThat(repository.existsById(donor1.getId())).isTrue();
    assertThat(repository.existsById(donor2.getId())).isTrue();

    // Read the entities
    val result1 = repository.findById(donor1.getId()).get();
    val result2 = repository.findById(donor2.getId()).get();

    // Verify simpleIds were automatically generated
    assertThat(result1.getSimpleId()).isNotNull();
    assertThat(result1.getSimpleId()).isGreaterThan(0);
    assertThat(result2.getSimpleId()).isNotNull();
    assertThat(result2.getSimpleId()).isGreaterThan(0);

    // Verify that simpleIds supplied during a persist operation are ignored
    assertThat(result1.getSimpleId()).isNotEqualTo(newSimpleId);
    assertThat(result2.getSimpleId()).isNotEqualTo(newSimpleId+2);

    // Update donor1 with newSimpleId
    donor1.setSimpleId(newSimpleId);
    repository.save(donor1);

    // Read the updated value
    val update = repository.findById(donor1.getId()).get();

    // Verify simpleId field was updated
    assertThat(update.getSimpleId()).isNotNull();
    assertThat(update.getSimpleId()).isGreaterThan(0);
    assertThat(update.getSimpleId()).isEqualTo(newSimpleId);
  }

  @Test
  public void uniqueConstraintDetection_ExistingEntities_Error(){
    val programId = UUID.randomUUID();
    val submitterId1 = generateUniqueSubmitterId();

    // Create entities
    val donor1 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(submitterId1);

    val donor2 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(generateUniqueSubmitterId());

    repository.save(donor1);
    repository.save(donor2);

    // Verify unique submitter ids
    val donor3 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(submitterId1);
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(() -> repository.save(donor3));

    // Verify unique simple ids
    val donor4 = new DonorEntity()
        .setProgramId(programId)
        .setSubmitterId(generateUniqueSubmitterId());
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(() -> repository.save(donor4));
  }

}
