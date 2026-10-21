package com.hermes.backend.infrastructure.web;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReadinessControllerTests {
    @Test
    void readyRequiresUsableDatabaseAndClosesConnection() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);
        mvc(source).perform(get("/internal/ready"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"))
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(connection).close();
    }

    @Test
    void unavailableDatabaseReturns503WithoutConnectionDetails() throws Exception {
        DataSource source = mock(DataSource.class);
        when(source.getConnection()).thenThrow(new SQLException("secret database credentials"));
        mvc(source).perform(get("/internal/ready"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"status\":\"DOWN\"}"));
    }

    @Test
    void invalidConnectionIsNotReady() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(false);
        mvc(source).perform(get("/internal/ready")).andExpect(status().isServiceUnavailable());
        verify(connection).close();
    }

    private MockMvc mvc(DataSource source) {
        return MockMvcBuilders.standaloneSetup(new ReadinessController(source)).build();
    }
}
