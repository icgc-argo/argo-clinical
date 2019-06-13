package org.icgc_argo.clinical.repository;

import org.icgc_argo.clinical.model.entity.ClinicalEntity;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.Optional;

@NoRepositoryBean
public interface ClinicalEntityRepository<T extends ClinicalEntity<ID>, ID> extends BaseRepository<T, ID>{

  Optional<T> findBySubmitterId(String submitterId);
  boolean existsBySubmitterId(String submitterId);

}
