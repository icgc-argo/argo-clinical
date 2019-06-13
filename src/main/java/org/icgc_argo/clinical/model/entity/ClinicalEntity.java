package org.icgc_argo.clinical.model.entity;

public interface ClinicalEntity<ID> {

  ID getId();

  Integer getSimpleId();

  String getSubmitterId();
}
