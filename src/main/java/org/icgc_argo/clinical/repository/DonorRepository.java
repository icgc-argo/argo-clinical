package org.icgc_argo.clinical.repository;

import org.icgc_argo.clinical.model.entity.DonorEntity;

import java.util.UUID;

public interface DonorRepository extends ClinicalEntityRepository<DonorEntity, UUID> {}
