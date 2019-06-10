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

package org.icgc_argo.grpc;

import org.icgc_argo.client.EgoClient;
import org.icgc_argo.converter.CarConverter;
import org.icgc_argo.grpc.interceptor.EgoAuthInterceptor.EgoAuth;
import bio.overture.proto.car_service.CarServiceGrpc;
import bio.overture.proto.car_service.CreateCarRequest;
import bio.overture.proto.car_service.CreateCarResponse;
import bio.overture.proto.car_service.GetCarRequest;
import bio.overture.proto.car_service.GetCarResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CarServiceImpl extends CarServiceGrpc.CarServiceImplBase implements Healthable {

  private final EgoClient egoClient;
  private final CarConverter carConverter;

  @Autowired
  public CarServiceImpl(@NonNull EgoClient egoClient, @NonNull CarConverter carConverter) {
    this.egoClient = egoClient;
    this.carConverter = carConverter;
  }

  @Override
  public String getHealthCheckName() {
    return CarServiceGrpc.SERVICE_NAME;
  }

  @Override
  @EgoAuth(typesAllowed = {"ADMIN"})
  public void createCar(
      CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
    CreateCarResponse response = null;
    try {
      log.info("Storing car: {}", request.toString());

      // For example, convert the DTO of type CreateCarRequest to the DAO of type CarModel
      val carModel = carConverter.createCarRequestToCarModel(request);

      // do something with carModel...
      carModel.setId(UUID.randomUUID());

      // For example, list the first 100 users from ego
      val users = egoClient.listUsers(0, 100, "");

      // For example, convert the DAO of type CarModel to DTO of type CreateCarResponse
      response = carConverter.carModelToCreateCarResponse(carModel);
    } catch (Throwable e) {
      log.error("Error processing car request {}: {}", request, e.getMessage());
      responseObserver.onError(Status.UNKNOWN.withDescription(e.getMessage()).asRuntimeException());
    }
    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  @EgoAuth(typesAllowed = {"USER"})
  public void getCar(GetCarRequest request, StreamObserver<GetCarResponse> responseObserver) {
    log.info("Reading the car for id: {}", request.getId());
    val response = GetCarResponse.newBuilder().setId(request.getId()).build();
    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }
}
