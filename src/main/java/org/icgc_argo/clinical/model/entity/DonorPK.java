package org.icgc_argo.clinical.model.entity;

import lombok.Data;

import java.io.Serializable;
import java.util.UUID;

@Data
public class DonorPK implements Serializable {

  private UUID id;

  private int entityId;

}
