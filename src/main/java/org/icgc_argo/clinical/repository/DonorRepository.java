package org.icgc_argo.clinical.repository;

import java.util.UUID;
import org.icgc_argo.clinical.model.entity.DonorEntity;

public interface DonorRepository extends ClinicalEntityRepository<DonorEntity, UUID> {}
