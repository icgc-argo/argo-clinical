package org.icgc_argo.clinical.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.Embeddable;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import java.io.Serializable;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Embeddable
public class DonorPK implements Serializable {

  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @GeneratedValue(strategy = GenerationType.SEQUENCE)
  private int entityId;

}
