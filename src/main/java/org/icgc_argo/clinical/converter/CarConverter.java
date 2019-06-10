package org.icgc_argo.clinical.converter;

import static org.mapstruct.MappingConstants.NULL;

import bio.overture.proto.car_service.CarData;
import bio.overture.proto.car_service.CreateCarRequest;
import bio.overture.proto.car_service.CreateCarResponse;
import bio.overture.proto.car_service.DriveTypeValue;
import lombok.val;
import org.icgc_argo.clinical.model.CarModel;
import org.icgc_argo.clinical.model.DriveType;
import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ValueMapping;

@Mapper(
    config = ConverterConfig.class,
    uses = {CommonConverter.class})
public interface CarConverter {

  @Mapping(target = "id", ignore = true)
  CarModel carDataToCarModel(CarData carData);

  @Mapping(target = "clearField", ignore = true)
  @Mapping(target = "clearOneof", ignore = true)
  @Mapping(target = "mergeFrom", ignore = true)
  @Mapping(target = "mergeBrand", ignore = true)
  @Mapping(target = "mergeModel", ignore = true)
  @Mapping(target = "mergeType", ignore = true)
  @Mapping(target = "mergeCreationDate", ignore = true)
  @Mapping(target = "mergeHorsepower", ignore = true)
  @Mapping(target = "mergeElectric", ignore = true)
  @Mapping(target = "mergeUnknownFields", ignore = true)
  @Mapping(target = "unknownFields", ignore = true)
  @Mapping(target = "allFields", ignore = true)
  @InheritInverseConfiguration
  CarData carModelToCarData(CarModel carModel);

  @ValueMapping(source = "ALL_WHEEL", target = "ALL")
  @ValueMapping(source = "BACK_WHEEL", target = "BACK")
  @ValueMapping(source = "FRONT_WHEEL", target = "FRONT")
  @ValueMapping(source = "UNRECOGNIZED", target = NULL)
  DriveType driveTypeProtoToModel(bio.overture.proto.car_service.DriveType proto);

  @InheritInverseConfiguration
  bio.overture.proto.car_service.DriveType driveTypeModelToProto(DriveType model);

  @Mapping(target = "clearField", ignore = true)
  @Mapping(target = "clearOneof", ignore = true)
  @Mapping(target = "mergeId", ignore = true)
  @Mapping(target = "mergeCar", ignore = true)
  @Mapping(target = "mergeFrom", ignore = true)
  @Mapping(target = "mergeUnknownFields", ignore = true)
  @Mapping(target = "unknownFields", ignore = true)
  @Mapping(target = "allFields", ignore = true)
  @Mapping(source = "model", target = "car")
  @Mapping(source = "model.id", target = "id")
  // WORKAROUND:  https://github.com/mapstruct/mapstruct/issues/607#issuecomment-309547739
  CreateCarResponse carModelToCreateCarResponse(Integer dummy, CarModel model);

  default CreateCarResponse carModelToCreateCarResponse(CarModel model) {
    return carModelToCreateCarResponse(0, model);
  }

  default CarModel createCarRequestToCarModel(CreateCarRequest r) {
    val carData = r.getCar();
    return carDataToCarModel(carData);
  }

  /**
   * Enum Boxing Converters
   *
   * @param proto
   */
  default DriveTypeValue boxDriveType(bio.overture.proto.car_service.DriveType proto) {
    return DriveTypeValue.newBuilder().setValue(proto).build();
  }

  default bio.overture.proto.car_service.DriveType unboxDriveType(DriveTypeValue v) {
    return v.getValue();
  }
}
