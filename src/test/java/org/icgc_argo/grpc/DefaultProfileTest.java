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

import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.icgc_argo.grpc.interceptor.EgoAuthInterceptor;
import org.icgc_argo.security.EgoSecurity;
import bio.overture.proto.car_service.CarServiceGrpc;
import bio.overture.proto.car_service.CreateCarRequest;
import bio.overture.proto.car_service.CreateCarResponse;
import io.grpc.Channel;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import io.grpc.testing.GrpcCleanupRule;
import lombok.SneakyThrows;
import lombok.val;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.mockito.Mock;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("default")
public class DefaultProfileTest {

  private Channel channel;

  private String serverName;

  @Mock private EgoSecurity egoSecurity;

  @Rule public final GrpcCleanupRule grpcCleanup = new GrpcCleanupRule();

  @Before
  public void setUp() {
    // Generate a unique in-process server name.
    serverName = InProcessServerBuilder.generateName();
    // Create a client channel and register for automatic graceful shutdown.
    channel =
        grpcCleanup.register(InProcessChannelBuilder.forName(serverName).directExecutor().build());
  }

  @SneakyThrows
  @Test
  public void egoInterceptorDisabled() {
    val target =
        new CarServiceGrpc.CarServiceImplBase() {
          @Override
          @EgoAuthInterceptor.EgoAuth(typesAllowed = {"ADMIN"})
          public void createCar(
              CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
            responseObserver.onNext(CreateCarResponse.getDefaultInstance());
            responseObserver.onCompleted();
          }
        };

    // Create a server, add service, start, and register for automatic graceful shutdown.
    grpcCleanup.register(
        InProcessServerBuilder.forName(serverName)
            .directExecutor()
            .addService(target)
            .build()
            .start());

    val blockingStub = CarServiceGrpc.newBlockingStub(channel);

    // EgoService is not initialized under default profile
    assertNull(egoSecurity);

    // Ego interceptor is not stopping create request, as expected
    val detail = blockingStub.createCar(CreateCarRequest.getDefaultInstance());
    assertTrue(detail.equals(CreateCarResponse.getDefaultInstance()));
  }
}
