package org.icgc_argo.clinical.repository;

import java.util.Optional;
import org.icgc_argo.clinical.model.entity.ClinicalEntity;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface ClinicalEntityRepository<T extends ClinicalEntity<ID>, ID>
    extends BaseRepository<T, ID> {

  Optional<T> findBySubmitterId(String submitterId);

  boolean existsBySubmitterId(String submitterId);

  boolean existsBySimpleId(Integer simpleId);

  Optional<T> findBySimpleId(Integer simpleId);
}
